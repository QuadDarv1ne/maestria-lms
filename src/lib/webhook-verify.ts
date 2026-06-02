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
  const { rawBody, signature, secret } = opts;

  if (!signature) {
    return { valid: false };
  }

  // Support "alg=signature" format (e.g., Stripe-style)
  // Use lastIndexOf("=") to correctly handle base64 signatures with padding
  let algorithm = "sha256";
  let signatureValue = signature;

  const eqIdx = signature.lastIndexOf("=");
  if (eqIdx > 0) {
    const maybeAlg = signature.slice(0, eqIdx);
    if (maybeAlg === "sha256" || maybeAlg === "sha512") {
      algorithm = maybeAlg;
      signatureValue = signature.slice(eqIdx + 1);
    }
  }

  const hmac = crypto.createHmac(algorithm, secret);
  const computedDigest = hmac.update(rawBody).digest("hex");

  // Constant-time comparison to prevent timing attacks
  // Length check prevents timingSafeEqual from throwing RangeError
  // on mismatched buffer sizes (which would leak server state via 500).
  if (signatureValue.length !== computedDigest.length) {
    return { valid: false, algorithm };
  }
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signatureValue),
    Buffer.from(computedDigest),
  );

  return { valid: isValid, algorithm };
}
