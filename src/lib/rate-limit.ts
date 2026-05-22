import { NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();
const CLEANUP_INTERVAL = 60_000;

function cleanup() {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }
}

// Store interval ID in globalThis so HMR/module reloads don't leak orphaned intervals
const GLOBAL_MARKER = "__rateLimitCleanupInterval";
if (typeof globalThis !== "undefined" && !(globalThis as Record<string, unknown>)[GLOBAL_MARKER]) {
  (globalThis as Record<string, unknown>)[GLOBAL_MARKER] = setInterval(cleanup, CLEANUP_INTERVAL);
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 30,
};

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    // Validate that it looks like a real IP (not a spoofed header value)
    // Reject private/reserved ranges that would indicate spoofing
    if (isValidPublicIp(firstIp)) {
      return firstIp;
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && isValidPublicIp(realIp)) return realIp;
  return "anonymous";
}

/**
 * Check if an IP is a valid public IP (not private, loopback, or reserved).
 * This prevents attackers from spoofing rate limits by sending fake
 * x-forwarded-for headers with private IPs.
 */
function isValidPublicIp(ip: string): boolean {
  // Basic IPv4 validation
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!ipv4Match) return false;

  const [, a, b] = ipv4Match.map(Number);

  // Reject private/reserved ranges:
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 0.0.0.0/8
  if (a === 10) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 127) return false;
  if (a === 0) return false;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return false;

  return true;
}

export function rateLimit(
  routeId: string,
  config: Partial<RateLimitConfig> = {}
) {
  const { windowMs, maxRequests } = { ...defaultConfig, ...config };

  let store = stores.get(routeId);
  if (!store) {
    store = new Map();
    stores.set(routeId, store);
  }

  return (request: Request): NextResponse | null => {
    const ip = getClientIp(request);
    const now = Date.now();
    const key = `${ip}`;

    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      return NextResponse.json(
        { error: "Слишком много запросов. Пожалуйста, повторите позже." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
          },
        }
      );
    }

    return null;
  };
}


export const RATE_LIMITS = {
  register: { windowMs: 60_000, maxRequests: 5 },
  forgotPassword: { windowMs: 60_000, maxRequests: 3 },
  login: { windowMs: 60_000, maxRequests: 10 },
  admin: { windowMs: 60_000, maxRequests: 60 },
  upload: { windowMs: 60_000, maxRequests: 10 },
  payments: { windowMs: 60_000, maxRequests: 20 },
  paymentUpdate: { windowMs: 60_000, maxRequests: 30 },
  enrollment: { windowMs: 60_000, maxRequests: 10 },
  progress: { windowMs: 60_000, maxRequests: 60 },
  review: { windowMs: 60_000, maxRequests: 10 },
  profile: { windowMs: 60_000, maxRequests: 20 },
  twoFactor: { windowMs: 60_000, maxRequests: 10 },
  default: { windowMs: 60_000, maxRequests: 30 },
} as const;
