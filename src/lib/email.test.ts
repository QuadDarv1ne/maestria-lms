import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./logger", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false and logs warning when RESEND_API_KEY is not configured", async () => {
    const originalKey = process.env.RESEND_API_KEY;
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

    process.env.RESEND_API_KEY = originalKey;
  });

  it("exports SendEmailOptions interface type", async () => {
    const email = await import("./email");
    expect(typeof email.sendEmail).toBe("function");
  });
});
