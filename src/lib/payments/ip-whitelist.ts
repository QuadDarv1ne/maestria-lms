/**
 * IP whitelist for payment provider webhooks.
 *
 * Each provider publishes the source IP ranges of its webhook servers.
 * Always verify the incoming request's IP against these ranges — never trust
 * the body alone, even when HMAC signature looks valid (signature secret
 * could be compromised).
 *
 * Sources:
 *  - YooKassa: https://yookassa.ru/developers/using-api/webhooks#security
 *  - Tinkoff:  configured in merchant cabinet per-terminal
 *  - CloudPayments: https://developers.cloudpayments.ru/#api-callback
 *  - Sber: per-merchant
 *  - Ozon: per-merchant
 */

const RANGES: Record<string, readonly string[]> = {
  // YooKassa webhook source IPs (as of 2025)
  YOOKASSA: [
    "185.71.76.0/27",
    "185.71.77.0/27",
    "77.75.153.0/25",
    "77.75.154.128/25",
    "77.75.156.11",
    "77.75.156.35",
    "2a02:5180::/32",
  ],
  // CloudPayments webhook source IPs
  CLOUDPAYMENTS: [
    "130.193.38.0/24",
    "130.193.70.0/24",
    "185.98.85.0/24",
  ],
  // Tinkoff / T-Bank — published ranges may change; configure via env if needed
  TINKOFF: [
    "91.213.108.0/24",
    "178.248.232.0/21",
    "188.93.24.0/21",
  ],
  // For SBER, OZON, VTB, MKB the IPs are merchant-specific — leave empty
  // and rely on signature verification only.
  SBER: [],
  OZON: [],
  VTB: [],
  MKB: [],
};

/** Convert IPv4 "a.b.c.d" → 32-bit integer. Returns -1 on parse error. */
function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return -1;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/** Convert CIDR "a.b.c.d/n" → [networkInt, maskInt]. Returns null on error. */
function parseCidr(cidr: string): [number, number] | null {
  const [ip, prefixStr] = cidr.split("/");
  const ipInt = ipv4ToInt(ip);
  if (ipInt < 0) return null;
  const prefix = prefixStr === undefined ? 32 : Number(prefixStr);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return [ipInt & mask, mask];
}

/**
 * Check whether the client IP falls within any of the provider's published
 * ranges. Returns `true` when the provider has no IP whitelist configured
 * (caller must then rely on signature verification).
 */
export function isIpAllowed(provider: string, clientIp: string | undefined): boolean {
  const ranges = RANGES[provider];
  if (!ranges || ranges.length === 0) return true; // no IP restriction for this provider

  if (!clientIp) return false;

  // Take the first IP from x-forwarded-for chain (already split by caller).
  const ip = clientIp.trim();
  if (!ip) return false;

  // IPv6 — full-string compare only (rare case, mainly YooKassa IPv6 range).
  if (ip.includes(":")) {
    return ranges.some((r) => r.includes(":") && r === ip);

  }

  const ipInt = ipv4ToInt(ip);
  if (ipInt < 0) return false;

  return ranges.some((cidr) => {
    const parsed = parseCidr(cidr);
    if (!parsed) return false;
    const [net, mask] = parsed;
    return (ipInt & mask) === net;
  });
}
