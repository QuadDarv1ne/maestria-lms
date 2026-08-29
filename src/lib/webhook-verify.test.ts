/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyWebhookSignature } from "@/lib/webhook-verify";

function sign(rawBody: string, secret: string, algorithm: "sha256" | "sha512" = "sha256") {
  return crypto.createHmac(algorithm, secret).update(rawBody).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const secret = "test-secret";

  it("accepts a valid sha256 signature", () => {
    const rawBody = '{"event":"payment.succeeded"}';
    const sig = sign(rawBody, secret);
    const result = verifyWebhookSignature({ rawBody, signature: sig, secret });
    expect(result.valid).toBe(true);
    expect(result.algorithm).toBe("sha256");
  });

  it("rejects when signature is missing", () => {
    const result = verifyWebhookSignature({ rawBody: "{}", signature: null, secret });
    expect(result.valid).toBe(false);
  });

  it("rejects tampered body", () => {
    const rawBody = '{"event":"payment.succeeded"}';
    const sig = sign(rawBody, secret);
    const result = verifyWebhookSignature({ rawBody: '{"event":"payment.canceled"}', signature: sig, secret });
    expect(result.valid).toBe(false);
  });

  it("rejects signature with wrong length", () => {
    const result = verifyWebhookSignature({ rawBody: "{}", signature: "short", secret });
    expect(result.valid).toBe(false);
    expect(result.algorithm).toBe("sha256");
  });

  it("rejects a valid signature signed with a different secret", () => {
    const rawBody = "payload";
    const sig = sign(rawBody, "other-secret");
    const result = verifyWebhookSignature({ rawBody, signature: sig, secret });
    expect(result.valid).toBe(false);
  });

  it("supports the alg=signature prefix (Stripe-style)", () => {
    const rawBody = "payload";
    const sig = `sha256=${sign(rawBody, secret)}`;
    const result = verifyWebhookSignature({ rawBody, signature: sig, secret });
    expect(result.valid).toBe(true);
    expect(result.algorithm).toBe("sha256");
  });

  it("supports sha512", () => {
    const rawBody = "payload";
    const sig = `sha512=${sign(rawBody, secret, "sha512")}`;
    const result = verifyWebhookSignature({ rawBody, signature: sig, secret });
    expect(result.valid).toBe(true);
    expect(result.algorithm).toBe("sha512");
  });

  it("does not treat non-algorithm equals-sign prefix as algorithm", () => {
    // A signature containing "=" in the middle without alg prefix should fail cleanly
    const signature = "abc=def";
    const result = verifyWebhookSignature({ rawBody: "{}", signature, secret });
    expect(result.valid).toBe(false);
  });
});