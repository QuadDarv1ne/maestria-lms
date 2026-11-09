// @vitest-environment node
/**
 * Unit tests for createSubmissionWithinAttemptLimit.
 *
 * Exercises: unlimited, bounded with remaining slots, limit exceeded, and
 * retry behaviour on Prisma serialization failure (P2034).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { db, Prisma } = vi.hoisted(() => ({
  db: {
    assignmentSubmission: {
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  Prisma: {
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
}));

vi.mock("@/lib/db", () => ({
  db: db,
  Prisma: Prisma,
}));

import { createSubmissionWithinAttemptLimit } from "@/lib/assignment-submission";

const input = {
  assignmentId: "asgn-1",
  userId: "user-1",
  maxAttempts: 3,
  data: { answer: "A", status: "graded", score: 100 },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.assignmentSubmission.count.mockReset();
  db.assignmentSubmission.create.mockReset();
  db.$transaction.mockReset();
});

describe("createSubmissionWithinAttemptLimit", () => {
  it("skips transaction when maxAttempts is 0 (unlimited)", async () => {
    db.assignmentSubmission.create.mockResolvedValue({
      id: "sub-1",
      status: "graded",
      score: 100,
    });

    const result = await createSubmissionWithinAttemptLimit({
      ...input,
      maxAttempts: 0,
    });

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.assignmentSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId: "asgn-1",
          userId: "user-1",
          maxScore: 100,
        }),
      })
    );
    expect(result).toEqual({
      submission: { id: "sub-1", status: "graded", score: 100 },
    });
  });

  it("returns { submission } when count < maxAttempts", async () => {
    db.$transaction.mockImplementation(async (fn) => {
      const tx = {
        assignmentSubmission: {
          count: vi.fn().mockResolvedValue(2),
          create: vi.fn().mockResolvedValue({ id: "sub-2", status: "graded", score: 80 }),
        },
      };
      return fn(tx);
    });

    const result = await createSubmissionWithinAttemptLimit(input);

    expect(result).toEqual({
      submission: { id: "sub-2", status: "graded", score: 80 },
    });
  });

  it("returns { limitExceeded } when count >= maxAttempts", async () => {
    db.$transaction.mockImplementation(async (fn) => {
      const tx = {
        assignmentSubmission: {
          count: vi.fn().mockResolvedValue(3),
          create: vi.fn(),
        },
      };
      return fn(tx);
    });

    const result = await createSubmissionWithinAttemptLimit(input);

    expect(result).toEqual({ limitExceeded: true, attemptCount: 3 });
  });

  it("retries up to MAX_RETRIES on P2034 and then throws", async () => {
    const serialError = { code: "P2034" };

    db.$transaction
      .mockRejectedValueOnce(serialError)
      .mockRejectedValueOnce(serialError)
      .mockRejectedValueOnce(serialError);

    await expect(createSubmissionWithinAttemptLimit(input)).rejects.toEqual(serialError);
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });

  it("bubbles non-P2034 errors immediately", async () => {
    db.$transaction.mockRejectedValueOnce(new Error("disk full"));

    await expect(createSubmissionWithinAttemptLimit(input)).rejects.toThrow("disk full");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("uses Serializable isolation level", async () => {
    let capturedLevel: string | undefined;
    db.$transaction.mockImplementation(async (fn, options) => {
      capturedLevel = options?.isolationLevel as string | undefined;
      const tx = {
        assignmentSubmission: {
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue({ id: "sub-3", status: "draft", score: null }),
        },
      };
      return fn(tx);
    });

    const result = await createSubmissionWithinAttemptLimit(input);
    expect(capturedLevel).toBe("Serializable");
    expect(result).toEqual({
      submission: { id: "sub-3", status: "draft", score: null },
    });
  });

  it("passes maxScore: 100 to create", async () => {
    let capturedData: Record<string, unknown> | undefined;
    db.$transaction.mockImplementation(async (fn) => {
      const tx = {
        assignmentSubmission: {
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            capturedData = args.data as Record<string, unknown>;
            return Promise.resolve({ id: "sub-4", status: "graded", score: 50 });
          }),
        },
      };
      return fn(tx);
    });

    await createSubmissionWithinAttemptLimit(input);
    expect(capturedData?.maxScore).toBe(100);
  });
});
