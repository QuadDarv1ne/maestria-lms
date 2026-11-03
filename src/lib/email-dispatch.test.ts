import { describe, it, expect, vi, beforeEach } from "vitest";

const { log, queue, sent } = vi.hoisted(() => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  queue: {
    enqueueEmail: vi.fn(),
  },
  sent: vi.fn(),
}));

vi.mock("./logger", () => ({ log }));
vi.mock("./email-queue", () => queue);
vi.mock("./email", () => ({ sendEmail: sent }));

import { dispatchEmail } from "./email-dispatch";

beforeEach(() => {
  vi.clearAllMocks();
  queue.enqueueEmail.mockResolvedValue(undefined);
  sent.mockResolvedValue(true);
});

describe("dispatchEmail", () => {
  it("enqueues the email when Redis is available", async () => {
    const result = await dispatchEmail({
      to: "user@example.com",
      subject: "Subject",
      html: "<p>Hi</p>",
    });

    expect(result).toBe(true);
    expect(queue.enqueueEmail).toHaveBeenCalledWith({
      to: "user@example.com",
      subject: "Subject",
      html: "<p>Hi</p>",
      priority: undefined,
    });
    expect(sent).not.toHaveBeenCalled();
  });

  it("honours priority", async () => {
    await dispatchEmail({
      to: "x@x.com",
      subject: "S",
      html: "<p>H</p>",
      priority: "urgent",
    });
    expect(queue.enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "urgent" }),
    );
  });

  it("sends directly when enqueue fails (Redis unavailable)", async () => {
    queue.enqueueEmail.mockRejectedValueOnce(new Error("Redis unavailable"));

    const result = await dispatchEmail({
      to: "user@example.com",
      subject: "Subject",
      html: "<p>Hi</p>",
    });

    expect(result).toBe(true);
    expect(sent).toHaveBeenCalledWith({
      to: "user@example.com",
      subject: "Subject",
      html: "<p>Hi</p>",
    });
    expect(log.warn).toHaveBeenCalledWith(
      "Email queue unavailable, sending directly",
      expect.anything(),
    );
  });

  it("returns false when sendEmail fails in fallback", async () => {
    queue.enqueueEmail.mockRejectedValueOnce(new Error("Redis unavailable"));
    sent.mockResolvedValueOnce(false);

    const result = await dispatchEmail({
      to: "x@x.com",
      subject: "S",
      html: "<p>H</p>",
    });

    expect(result).toBe(false);
  });

  it("bypasses the queue when direct is true", async () => {
    const result = await dispatchEmail({
      to: "user@example.com",
      subject: "Subject",
      html: "<p>Hi</p>",
      direct: true,
    });

    expect(result).toBe(true);
    expect(sent).toHaveBeenCalled();
    expect(queue.enqueueEmail).not.toHaveBeenCalled();
  });
});
