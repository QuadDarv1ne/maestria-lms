// @vitest-environment node
/**
 * Unit tests for the payment service orchestration layer
 * (src/lib/payments/service.ts):
 *   - repeat-request handling for an existing pending payment must report the
 *     provider/method the payment was actually created with (not the ones from
 *     the current request),
 *   - promo code redemption happens only when the payment actually completes
 *     (a canceled payment must not burn the user's attempt).
 *
 * The real provider registry is used; env credentials stay unset so
 * providers report isConfigured() === false and the service returns test mode
 * without touching the network.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    siteUrl: "http://localhost:3000",
    paymentWebhookSecret: undefined,
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// In-memory fake of the Prisma surface the service touches.
const state = vi.hoisted(() => {
  const state = {
    course: null as Record<string, unknown> | null,
    payment: null as Record<string, unknown> | null,
    createdPayments: [] as Array<Record<string, unknown>>,
    updatedPayments: [] as Array<Record<string, unknown>>,
    enrollment: null as Record<string, unknown> | null,
    studentCountIncremented: 0,
  };
  return state;
});

vi.mock("@/lib/db", () => ({
  db: {
    course: {
      findUnique: vi.fn(async () => state.course),
    },
    user: {
      findUnique: vi.fn(async () => ({ email: "u@test", name: "U", phone: null })),
    },
    payment: {
      findFirst: vi.fn(async () => state.payment),
      findUnique: vi.fn(async () => state.payment),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state.payment ?? {}, data);
        return state.payment;
      }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.updatedPayments.push(data);
        Object.assign(state.payment ?? {}, data);
        return { count: state.payment ? 1 : 0 };
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: data.id ?? "new-pay-1", ...data };
        state.createdPayments.push(row);
        state.payment = row;
        return row;
      }),
    },
    enrollment: {
      findUnique: vi.fn(async () => state.enrollment),
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
        state.enrollment = create;
        return create;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          payment: {
            findFirst: vi.fn(async () => state.payment),
            findUnique: vi.fn(async () => state.payment),
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
              const row = { id: data.id ?? "tx-new-pay", ...data };
              state.createdPayments.push(row);
              state.payment = row;
              return row;
            }),
            updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
              state.updatedPayments.push(data);
              Object.assign(state.payment ?? {}, data);
              return { count: state.payment ? 1 : 0 };
            }),
          },
          enrollment: {
            findUnique: vi.fn(async () => state.enrollment),
            upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
              state.enrollment = create;
              return create;
            }),
            updateMany: vi.fn(async () => ({ count: 0 })),
          },
          course: {
            updateMany: vi.fn(async () => {
              state.studentCountIncremented += 1;
              return { count: 1 };
            }),
          },
        }),
    ),
  },
  Prisma: {},
}));

vi.mock("@/lib/promo-code", () => ({
  validatePromoCode: vi.fn(async () => ({
    valid: true,
    promoCode: { id: "promo-1", code: "SALE", discountType: "percentage", discountValue: 10, maxDiscount: null },
    discountAmount: 10,
    finalPrice: 90,
  })),
  redeemPromoCode: vi.fn(async () => {}),
}));

// Proxy the real registry but expose getProvider as a mock so individual
// tests can substitute a fake provider (e.g. to stub getPaymentStatus).
vi.mock("@/lib/payments/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payments/registry")>();
  return {
    ...actual,
    getProvider: vi.fn((name: Parameters<typeof actual.getProvider>[0]) => actual.getProvider(name)),
  };
});

import { redeemPromoCode } from "@/lib/promo-code";
import { getProvider } from "@/lib/payments/registry";
import {
  createCoursePayment,
  completePayment,
  syncPaymentWithProvider,
  ServiceError,
} from "@/lib/payments/service";
import type { IPaymentProvider } from "@/lib/payments/types";

function baseCourse(): Record<string, unknown> {
  return {
    id: "course-1",
    title: "Курс",
    isPublished: true,
    visibility: "public",
    price: 100,
    currency: "RUB",
  };
}

function resetState() {
  state.course = baseCourse();
  state.payment = null;
  state.createdPayments = [];
  state.updatedPayments = [];
  state.enrollment = null;
  state.studentCountIncremented = 0;
}

beforeEach(() => {
  resetState();
  // Reset call history (implementations created via vi.fn(...) stay intact).
  vi.clearAllMocks();
});

describe("createCoursePayment — existing pending payment", () => {
  it("returns the provider/method the pending payment was created with, not the ones from the current request", async () => {
    // The payment was created earlier via YooKassa SBP; the client now retries
    // with Tinkoff card. The response must still point at YooKassa SBP.
    state.payment = {
      id: "pay-1",
      amount: 100,
      currency: "RUB",
      status: "pending",
      paymentMethod: "sbp",
      paymentProvider: "YOOKASSA",
      paymentData: JSON.stringify({ confirmationUrl: "https://yoomoney.ru/pay/1" }),
    };

    const result = await createCoursePayment({
      userId: "user-1",
      courseId: "course-1",
      provider: "TINKOFF",
      method: "CARD",
    });

    expect(result.existing).toBe(true);
    expect(result.provider).toBe("YOOKASSA");
    expect(result.paymentMethod).toBe("SBP");
    expect(result.confirmationUrl).toBe("https://yoomoney.ru/pay/1");
  });

  it("falls back to the requested pair for legacy rows without a stored provider", async () => {
    state.payment = {
      id: "pay-legacy",
      amount: 100,
      currency: "RUB",
      status: "pending",
      paymentMethod: null,
      paymentProvider: null,
      paymentData: null,
    };

    const result = await createCoursePayment({
      userId: "user-1",
      courseId: "course-1",
      provider: "TINKOFF",
      method: "CARD",
    });

    expect(result.existing).toBe(true);
    expect(result.provider).toBe("TINKOFF");
    expect(result.paymentMethod).toBe("CARD");
  });

  it("rejects with ALREADY_PAID when a completed payment exists", async () => {
    state.payment = {
      id: "pay-done",
      amount: 100,
      currency: "RUB",
      status: "completed",
      paymentMethod: "card",
      paymentProvider: "YOOKASSA",
      paymentData: null,
    };

    await expect(
      createCoursePayment({ userId: "user-1", courseId: "course-1", method: "CARD" }),
    ).rejects.toMatchObject({
      code: "ALREADY_PAID",
    } satisfies Partial<ServiceError>);
  });
});

describe("createCoursePayment — promo code is stored but NOT redeemed", () => {
  it("persists promoCodeId on the pending row without burning the attempt", async () => {
    const result = await createCoursePayment({
      userId: "user-1",
      courseId: "course-1",
      method: "CARD",
      promoCode: "SALE",
    });

    expect(result.testMode).toBe(true); // provider not configured
    expect(state.createdPayments).toHaveLength(1);
    expect(state.createdPayments[0].promoCodeId).toBe("promo-1");
    expect(state.createdPayments[0].discountAmount).toBe(10);
    expect(state.createdPayments[0].amount).toBe(90);
    expect(redeemPromoCode).not.toHaveBeenCalled();
  });
});

describe("completePayment — promo code redemption", () => {
  it("redeems the promo code when the payment actually completes", async () => {
    state.payment = {
      id: "pay-1",
      status: "pending",
      userId: "user-1",
      courseId: "course-1",
      promoCodeId: "promo-1",
      amount: 90,
      currency: "RUB",
      course: { title: "Курс" },
      user: { email: "u@test" },
    };

    const result = await completePayment("pay-1", "tx-1");

    expect(result.alreadyCompleted).toBe(false);
    expect(redeemPromoCode).toHaveBeenCalledWith("promo-1", "user-1");
    expect(state.payment?.status).toBe("completed");
    expect(state.studentCountIncremented).toBe(1);
  });

  it("does not redeem anything for an already-completed payment", async () => {
    state.payment = {
      id: "pay-1",
      status: "completed",
      userId: "user-1",
      courseId: "course-1",
      promoCodeId: "promo-1",
      amount: 90,
      currency: "RUB",
      course: { title: "Курс" },
      user: { email: "u@test" },
    };

    const result = await completePayment("pay-1", "tx-1");

    expect(result.alreadyCompleted).toBe(true);
    expect(redeemPromoCode).not.toHaveBeenCalled();
  });

  it("completes without a promo code", async () => {
    state.payment = {
      id: "pay-2",
      status: "pending",
      userId: "user-1",
      courseId: "course-1",
      promoCodeId: null,
      amount: 100,
      currency: "RUB",
      course: { title: "Курс" },
      user: { email: "u@test" },
    };

    const result = await completePayment("pay-2", "tx-2");

    expect(result.alreadyCompleted).toBe(false);
    expect(redeemPromoCode).not.toHaveBeenCalled();
    expect(state.payment?.status).toBe("completed");
  });
});

/** Minimal provider double: only what syncPaymentWithProvider touches. */
function fakeProvider(
  getPaymentStatus: (id: string) => Promise<string> | string,
): IPaymentProvider {
  return {
    isConfigured: () => true,
    getPaymentStatus: vi.fn(async (id: string) => getPaymentStatus(id)),
  } as unknown as IPaymentProvider;
}

describe("syncPaymentWithProvider — pull reconciliation", () => {
  function pendingPayment(overrides: Record<string, unknown> = {}) {
    state.payment = {
      id: "pay-sync",
      status: "pending",
      userId: "user-1",
      courseId: "course-1",
      amount: 100,
      currency: "RUB",
      paymentProvider: "YOOKASSA",
      transactionId: "yoo-provider-1",
      promoCodeId: null,
      ...overrides,
    };
  }

  it("completes the payment when the provider reports succeeded", async () => {
    pendingPayment();
    vi.mocked(getProvider).mockReturnValueOnce(fakeProvider(() => "completed"));

    const outcome = await syncPaymentWithProvider("pay-sync");

    expect(outcome).toMatchObject({ synced: true, status: "completed", alreadyCompleted: false });
    expect(outcome.payment).toEqual({ id: "pay-sync", userId: "user-1", courseId: "course-1" });
    expect(state.payment?.status).toBe("completed");
    expect(state.studentCountIncremented).toBe(1);
  });

  it("fails the payment when the provider reports canceled", async () => {
    pendingPayment();
    vi.mocked(getProvider).mockReturnValueOnce(fakeProvider(() => "failed"));

    const outcome = await syncPaymentWithProvider("pay-sync");

    expect(outcome).toMatchObject({ synced: true, status: "failed" });
    expect(state.payment?.status).toBe("failed");
  });

  it("leaves the payment pending when the provider has no final status yet", async () => {
    pendingPayment();
    vi.mocked(getProvider).mockReturnValueOnce(fakeProvider(() => "pending"));

    const outcome = await syncPaymentWithProvider("pay-sync");

    expect(outcome).toMatchObject({ synced: false, status: "pending" });
    expect(state.payment?.status).toBe("pending");
  });

  it("survives a provider error without changing the payment", async () => {
    pendingPayment();
    vi.mocked(getProvider).mockReturnValueOnce(
      fakeProvider(() => {
        throw new Error("gateway down");
      }),
    );

    const outcome = await syncPaymentWithProvider("pay-sync");

    expect(outcome).toMatchObject({ synced: false, status: "unknown", reason: "provider_error" });
    expect(state.payment?.status).toBe("pending");
  });

  it("skips placeholder transaction ids (pending_/sim_)", async () => {
    pendingPayment({ transactionId: "pending_abcd" });
    expect((await syncPaymentWithProvider("pay-sync")).status).toBe("skipped");

    pendingPayment({ transactionId: "sim_12345" });
    expect((await syncPaymentWithProvider("pay-sync")).status).toBe("skipped");

    pendingPayment({ transactionId: null });
    expect((await syncPaymentWithProvider("pay-sync")).status).toBe("skipped");
  });

  it("skips non-pending payments and unconfigured providers", async () => {
    pendingPayment({ status: "completed" });
    expect((await syncPaymentWithProvider("pay-sync")).status).toBe("skipped");

    // Configured → skipped by the service layer without touching the provider.
    pendingPayment({ paymentProvider: null });
    expect((await syncPaymentWithProvider("pay-sync")).status).toBe("skipped");

    // Real YooKassa without credentials → not configured.
    vi.mocked(getProvider).mockReset();
    pendingPayment();
    expect((await syncPaymentWithProvider("pay-sync")).status).toBe("skipped");
  });
});
