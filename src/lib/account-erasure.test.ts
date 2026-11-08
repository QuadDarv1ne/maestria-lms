// @vitest-environment node
/**
 * Unit tests for account erasure (src/lib/account-erasure.ts).
 *
 * Erasure is anonymization, not a row delete: `Payment.userId` cascades, so
 * deleting the row would destroy the payment ledger that bookkeeping law
 * requires. The tests pin down exactly which fields are wiped, that
 * authentication material is dropped, and that the last admin is protected.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockTx, mockInvalidateJwtUserCache } = vi.hoisted(() => ({
  mockDb: {
    user: { findUnique: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
  mockTx: {
    session: { deleteMany: vi.fn() },
    account: { deleteMany: vi.fn() },
    verificationToken: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    user: { update: vi.fn() },
  },
  mockInvalidateJwtUserCache: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
// The erasure deactivates the account, so the cached isActive snapshot has to
// be dropped — otherwise the erased user keeps working for up to five minutes.
vi.mock("@/lib/jwt-user-cache", () => ({
  invalidateJwtUserCache: (...args: unknown[]) => mockInvalidateJwtUserCache(...args),
}));

import {
  ERASED_NAME,
  anonymizedEmail,
  eraseAccount,
} from "@/lib/account-erasure";

const USER_ID = "3f8a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b";
const EMAIL = "student@example.com";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.user.findUnique.mockResolvedValue({
    id: USER_ID,
    email: EMAIL,
    role: "student",
    isActive: true,
  });
  mockDb.user.count.mockResolvedValue(1);
  mockTx.session.deleteMany.mockResolvedValue({ count: 2 });
  mockTx.account.deleteMany.mockResolvedValue({ count: 1 });
  mockTx.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
  mockTx.notification.deleteMany.mockResolvedValue({ count: 5 });
  mockTx.user.update.mockResolvedValue({});
  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockTx));
});

describe("anonymizedEmail", () => {
  it("derives a unique address from the user id", () => {
    expect(anonymizedEmail(USER_ID)).toBe("deleted-3f8a1c2e4b5d4e6f@deleted.invalid");
  });

  it("is stable for the same id and different across ids", () => {
    expect(anonymizedEmail(USER_ID)).toBe(anonymizedEmail(USER_ID));
    expect(anonymizedEmail(USER_ID)).not.toBe(anonymizedEmail("another-id"));
  });

  it("never contains the original email domain", () => {
    expect(anonymizedEmail(USER_ID)).not.toContain("example.com");
  });
});

describe("eraseAccount", () => {
  it("wipes every directly identifying field in one transaction", async () => {
    const result = await eraseAccount(USER_ID);

    expect(result).toEqual({ erased: true });
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        email: anonymizedEmail(USER_ID),
        name: ERASED_NAME,
        passwordHash: null,
        phone: null,
        bio: null,
        image: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        pendingTwoFactorSecret: null,
        emailVerified: null,
        isActive: false,
      },
    });
  });

  it("drops authentication material instead of overwriting it", async () => {
    await eraseAccount(USER_ID);

    expect(mockTx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(mockTx.account.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it("removes verification tokens issued for the old address", async () => {
    await eraseAccount(USER_ID);

    expect(mockTx.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: { contains: EMAIL } },
    });
  });

  it("removes the user's notifications", async () => {
    await eraseAccount(USER_ID);

    expect(mockTx.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it("drops the cached status so the deactivation takes effect immediately", async () => {
    await eraseAccount(USER_ID);

    expect(mockInvalidateJwtUserCache).toHaveBeenCalledWith(USER_ID);
  });

  it("does not delete the user row, so payments keep their foreign key", async () => {
    await eraseAccount(USER_ID);

    // The absence of a delete call is the whole point of anonymization.
    expect(mockTx.user).not.toHaveProperty("delete");
    expect(mockTx.user.update).toHaveBeenCalledTimes(1);
  });

  it("returns not_found for an unknown user without touching anything", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const result = await eraseAccount(USER_ID);

    expect(result).toEqual({ erased: false, reason: "not_found" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("is idempotent: an already erased account is left alone", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: anonymizedEmail(USER_ID),
      role: "student",
      isActive: false,
    });

    const result = await eraseAccount(USER_ID);

    expect(result).toEqual({ erased: false, reason: "already_erased" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to erase the last active admin", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: "admin@example.com",
      role: "admin",
      isActive: true,
    });
    mockDb.user.count.mockResolvedValue(0);

    const result = await eraseAccount(USER_ID);

    expect(result).toEqual({ erased: false, reason: "last_admin" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
    expect(mockDb.user.count).toHaveBeenCalledWith({
      where: { role: "admin", isActive: true, id: { not: USER_ID } },
    });
  });

  it("allows an admin to erase themselves when another admin remains", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: "admin@example.com",
      role: "admin",
      isActive: true,
    });
    mockDb.user.count.mockResolvedValue(1);

    const result = await eraseAccount(USER_ID);

    expect(result).toEqual({ erased: true });
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
  });

  it("does not check the admin count for non-admin users", async () => {
    await eraseAccount(USER_ID);

    expect(mockDb.user.count).not.toHaveBeenCalled();
  });

  it("rethrows a transaction failure so the caller can report it", async () => {
    mockDb.$transaction.mockRejectedValue(new Error("deadlock"));

    await expect(eraseAccount(USER_ID)).rejects.toThrow("deadlock");
    expect(mockTx.user.update).not.toHaveBeenCalled();
  });
});
