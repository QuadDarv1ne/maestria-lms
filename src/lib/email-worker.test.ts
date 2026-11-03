import { describe, it, expect, vi, beforeEach } from "vitest";

const { queue, sent } = vi.hoisted(() => ({
  queue: {
    getQueueStats: vi.fn(),
    dequeueEmail: vi.fn(),
    completeEmail: vi.fn(),
    failEmail: vi.fn(),
    promoteDueRetries: vi.fn(),
    collectOrphanedJobs: vi.fn(),
  },
  sent: vi.fn(),
}));

vi.mock("./logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("./email-queue", () => queue);
vi.mock("./email", () => ({ sendEmail: sent }));
vi.mock("./redis", () => ({ getRedisClient: () => ({}) }));

import { processEmailQueue } from "./email-worker";

const job = (over: Record<string, unknown> = {}) => ({
  id: "job-1",
  to: "user@example.com",
  subject: "Subject",
  html: "<p>Hi</p>",
  text: "Hi",
  priority: "normal",
  retries: 0,
  maxRetries: 5,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  queue.getQueueStats.mockResolvedValue({
    pending: 0,
    delayed: 0,
    processing: 0,
    completed: 0,
    dead: 0,
    byPriority: { low: 0, normal: 0, high: 0, urgent: 0 },
  });
  queue.collectOrphanedJobs.mockResolvedValue(0);
  queue.promoteDueRetries.mockResolvedValue(0);
  queue.dequeueEmail.mockResolvedValue(null);
  queue.completeEmail.mockResolvedValue(undefined);
  queue.failEmail.mockResolvedValue({ retry: true });
  sent.mockResolvedValue(true);
});

describe("processEmailQueue", () => {
  it("sends a dequeued job and marks it complete", async () => {
    queue.dequeueEmail.mockResolvedValueOnce(job()).mockResolvedValue(null);

    const result = await processEmailQueue();

    expect(sent).toHaveBeenCalledWith({
      to: "user@example.com",
      subject: "Subject",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(queue.completeEmail).toHaveBeenCalledWith("job-1");
    expect(result).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
  });

  it("stops when the queue is empty", async () => {
    const result = await processEmailQueue();
    expect(result).toMatchObject({ processed: 0, succeeded: 0, failed: 0 });
  });

  it("respects batchSize", async () => {
    queue.dequeueEmail.mockResolvedValue(job());
    const result = await processEmailQueue({ batchSize: 3 });
    expect(queue.dequeueEmail).toHaveBeenCalledTimes(3);
    expect(result.processed).toBe(3);
  });

  it("fails a job when sendEmail reports the API key is missing", async () => {
    sent.mockResolvedValueOnce(false);
    queue.dequeueEmail.mockResolvedValueOnce(job()).mockResolvedValue(null);

    const result = await processEmailQueue();

    expect(queue.failEmail).toHaveBeenCalledWith("job-1", "RESEND_API_KEY not configured");
    expect(queue.completeEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ processed: 1, succeeded: 0, failed: 1 });
  });

  it("fails a job when sendEmail throws", async () => {
    sent.mockRejectedValueOnce(new Error("gateway down"));
    queue.dequeueEmail.mockResolvedValueOnce(job()).mockResolvedValue(null);

    const result = await processEmailQueue();

    expect(queue.failEmail).toHaveBeenCalledWith("job-1", "gateway down");
    expect(result).toMatchObject({ processed: 1, failed: 1 });
  });

  it("runs maintenance by default", async () => {
    await processEmailQueue();
    expect(queue.collectOrphanedJobs).toHaveBeenCalled();
    expect(queue.promoteDueRetries).toHaveBeenCalled();
  });

  it("skips maintenance when disabled", async () => {
    await processEmailQueue({ maintenance: false });
    expect(queue.collectOrphanedJobs).not.toHaveBeenCalled();
    expect(queue.promoteDueRetries).not.toHaveBeenCalled();
  });

  it("reports queue stats from the source of truth", async () => {
    const result = await processEmailQueue();
    expect(result.queueStats.pending).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
