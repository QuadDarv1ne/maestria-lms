import crypto from "crypto";

/**
 * Verify HMAC signature from payment provider webhook.
 * Supports both signature-in-header and signature-in-body patterns.
 */
export function verifyWebhookSignature(opts: {
  rawBody: string;
  signature: string | null;
  headerName?: string;
  secret: string;
}): { valid: boolean; algorithm?: string } {
  const { rawBody, signature, secret, headerName = "x-webhook-signature" } = opts;

  if (!signature) {
    return { valid: false };
  }

  // Support "alg=signature" format (e.g., Stripe-style)
  let algorithm = "sha256";
  let signatureValue = signature;

  if (signature.includes("=")) {
    const parts = signature.split("=");
    if (parts.length === 2) {
      const [maybeAlg, sig] = parts;
      if (maybeAlg === "sha256" || maybeAlg === "sha512") {
        algorithm = maybeAlg;
        signatureValue = sig;
      }
    }
  }

  const hmac = crypto.createHmac(algorithm, secret);
  const computedDigest = hmac.update(rawBody).digest("hex");

  // Constant-time comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signatureValue),
    Buffer.from(computedDigest),
  );

  return { valid: isValid, algorithm };
}
