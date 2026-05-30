import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./logger", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Resend
const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    constructor() {
      // no-op
    }
    emails = {
      send: mockSend,
    };
  },
}));

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    process.env.RESEND_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.RESEND_API_KEY;
  });

  it("returns false and logs warning when RESEND_API_KEY is not configured", async () => {
    delete process.env.RESEND_API_KEY;

    const { sendEmail } = await import("./email");
    const { log } = await import("./logger");

    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(
      "Email not sent: RESEND_API_KEY not configured",
      { to: "test@example.com", subject: "Test" },
    );
  });

  it("exports SendEmailOptions interface type", async () => {
    const email = await import("./email");
    expect(typeof email.sendEmail).toBe("function");
  });

  it("sends email successfully on first attempt", async () => {
    const { sendEmail } = await import("./email");
    const { log } = await import("./logger");

    mockSend.mockResolvedValueOnce({ id: "msg-123" });

    const result = sendEmail({
      to: "test@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    });

    await vi.runAllTimersAsync();
    const emailResult = await result;

    expect(emailResult).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith("Email sent successfully", {
      to: "test@example.com",
      subject: "Hello",
    });
  });

  it("retries on 500 error and succeeds", async () => {
    const { sendEmail } = await import("./email");
    const { log } = await import("./logger");

    mockSend
      .mockRejectedValueOnce({ statusCode: 500, message: "Server error" })
      .mockResolvedValueOnce({ id: "msg-456" });

    const result = sendEmail({
      to: "retry@example.com",
      subject: "Retry test",
      html: "<p>Retry</p>",
    });

    // First attempt fails immediately, then sleeps 1000ms before retry
    await vi.advanceTimersByTimeAsync(1000);
    await vi.runAllTimersAsync();
    const emailResult = await result;

    expect(emailResult).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(log.info).toHaveBeenCalledWith(
      "Email sent successfully after retry",
      { to: "retry@example.com", subject: "Retry test", attempt: 1 },
    );
  });

  it("retries on 429 rate limit error", async () => {
    const { sendEmail } = await import("./email");

    mockSend
      .mockRejectedValueOnce({ statusCode: 429, message: "Rate limited" })
      .mockResolvedValueOnce({ id: "msg-789" });

    const result = sendEmail({
      to: "rate@test.com",
      subject: "Rate limit",
      html: "<p>Rate</p>",
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.runAllTimersAsync();
    const emailResult = await result;

    expect(emailResult).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400 client error", async () => {
    const { sendEmail } = await import("./email");
    const { log } = await import("./logger");

    mockSend.mockRejectedValueOnce({ statusCode: 400, message: "Bad request" });

    const result = sendEmail({
      to: "bad@test.com",
      subject: "Bad request",
      html: "<p>Bad</p>",
    });

    await vi.runAllTimersAsync();
    const emailResult = await result;

    expect(emailResult).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith("Non-retryable email send error", expect.any(Object));
  });

  it("fails after max retries exhausted", async () => {
    const { sendEmail } = await import("./email");
    const { log } = await import("./logger");

    mockSend.mockRejectedValue({ statusCode: 500, message: "Server error" });

    const result = sendEmail({
      to: "fail@test.com",
      subject: "All retries failed",
      html: "<p>Fail</p>",
    });

    // 3 retries = 4 total attempts with delays: 0 + 1000 + 2000 + 4000 = 7000ms
    await vi.advanceTimersByTimeAsync(7000);
    await vi.runAllTimersAsync();
    const emailResult = await result;

    expect(emailResult).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(4);
    expect(log.error).toHaveBeenCalledWith(
      "Email send failed after all retries",
      expect.any(Object),
    );
  });
});
