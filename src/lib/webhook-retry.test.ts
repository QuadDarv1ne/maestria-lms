/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindUnique, mockUpdate, mockDeleteMany, mockFindMany } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    webhookEvent: {
      create: vi.fn(),
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      update: mockUpdate,
      deleteMany: mockDeleteMany,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  calculateRetryDelay,
  processWebhookWithRetry,
  processPendingWebhooks,
  cleanupOldWebhookEvents,
  type WebhookEvent,
} from "@/lib/webhook-retry";

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  const base: WebhookEvent = {
    id: "evt-1",
    type: "payment",
    payload: { id: "pay-1" },
    status: "pending",
    attempts: 0,
    maxAttempts: 5,
    lastAttemptAt: null,
    nextRetryAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides };
}

describe("calculateRetryDelay", () => {
  it("grows exponentially with attempts", () => {
    const delays = [0, 1, 2, 3, 4].map(calculateRetryDelay);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1] / 2);
    }
  });

  it("never exceeds max delay of 1 hour", () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const delay = calculateRetryDelay(attempt);
      expect(delay).toBeLessThanOrEqual(3600000);
    }
  });

  it("is always a positive integer", () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const delay = calculateRetryDelay(attempt);
      expect(Number.isInteger(delay)).toBe(true);
      expect(delay).toBeGreaterThan(0);
    }
  });
});

describe("processWebhookWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when event does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await processWebhookWithRetry("missing", async () => true);
    expect(result).toBe(false);
  });

  it("marks event completed on success", async () => {
    mockFindUnique.mockResolvedValue(makeEvent());
    mockUpdate.mockResolvedValue(makeEvent({ status: "completed" }));
    const result = await processWebhookWithRetry("evt-1", async () => true);
    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "completed" }),
      }),
    );
  });

  it("fails event after max attempts", async () => {
    mockFindUnique.mockResolvedValue(makeEvent({ attempts: 5, maxAttempts: 5 }));
    mockUpdate.mockResolvedValue(makeEvent({ status: "failed" }));
    const result = await processWebhookWithRetry("evt-1", async () => false);
    expect(result).toBe(false);
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("schedules a retry when handler fails before max attempts", async () => {
    mockFindUnique.mockResolvedValue(makeEvent({ attempts: 1 }));
    mockUpdate.mockResolvedValue(makeEvent({ status: "pending", nextRetryAt: new Date() }));
    const result = await processWebhookWithRetry("evt-1", async () => false);
    expect(result).toBe(false);
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "pending" }),
      }),
    );
  });
});

describe("processPendingWebhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes nothing when no pending events", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await processPendingWebhooks();
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });

  it("fails events that exceeded max attempts", async () => {
    mockFindMany.mockResolvedValue([makeEvent({ attempts: 5, maxAttempts: 5 })]);
    mockFindUnique.mockResolvedValue(makeEvent({ attempts: 5, maxAttempts: 5 }));
    mockUpdate.mockResolvedValue(makeEvent({ status: "failed" }));
    const result = await processPendingWebhooks();
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe("cleanupOldWebhookEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes old completed/failed events and returns count", async () => {
    mockDeleteMany.mockResolvedValue({ count: 7 });
    const result = await cleanupOldWebhookEvents(30);
    expect(result).toBe(7);
    expect(mockDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["completed", "failed"] },
        }),
      }),
    );
  });
});