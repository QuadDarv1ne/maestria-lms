import { NextResponse } from "next/server";
import type Redis from "ioredis";
import { log } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitResult {
  limited: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 30,
};

// NOTE: X-Forwarded-For is only trusted behind a reverse proxy that strips/overwrites it
// (Amvera, Cloudflare, nginx). For unauthenticated routes, prefer userId-based rate limiting
// when possible to avoid IP spoofing bypass.
function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (isValidPublicIp(firstIp)) {
      return firstIp;
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && isValidPublicIp(realIp)) return realIp;
  return "anonymous";
}

function isValidPublicIp(ip: string): boolean {
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);

    if (a === 10) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 127) return false;
    if (a === 0) return false;
    if (a === 169 && b === 254) return false;

    return true;
  }

  const normalizedIp = ip.toLowerCase();

  if (normalizedIp === "::1" || normalizedIp === "::") return false;
  if (normalizedIp.startsWith("::ffff:7f")) return false;
  if (normalizedIp.startsWith("::ffff:10.")) return false;
  if (normalizedIp.startsWith("::ffff:192.168.")) return false;
  if (normalizedIp.startsWith("::ffff:a9fe.")) return false;

  const ipv4MappedMatch = /^::ffff:(\d{1,3})\.(\d{1,3})/.exec(normalizedIp);
  if (ipv4MappedMatch) {
    const a = Number(ipv4MappedMatch[1]);
    const b = Number(ipv4MappedMatch[2]);
    if (a === 172 && b >= 16 && b <= 31) return false;
  }

  if (normalizedIp.startsWith("fc") || normalizedIp.startsWith("fd")) return false;
  if (normalizedIp.startsWith("fe8") || normalizedIp.startsWith("fe9") ||
      normalizedIp.startsWith("fea") || normalizedIp.startsWith("feb")) return false;

  return /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/.test(normalizedIp);
}

// In-memory fallback store with FIFO eviction
interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStores = new Map<string, Map<string, MemoryEntry>>();
const MEMORY_CLEANUP_INTERVAL = 60_000;
const MAX_MEMORY_ENTRIES = 10000;

function cleanupMemoryExpiredEntries() {
  const now = Date.now();
  for (const [routeId, store] of memoryStores) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
    if (store.size === 0) {
      memoryStores.delete(routeId);
    }
  }
}

const GLOBAL_MARKER = "__rateLimitMemoryCleanupInterval";
if (typeof globalThis !== "undefined" && !(globalThis as Record<string, unknown>)[GLOBAL_MARKER]) {
  const intervalId = setInterval(
    cleanupMemoryExpiredEntries,
    MEMORY_CLEANUP_INTERVAL,
  );
  // Prevent the interval from keeping the process alive in serverless environments
  if (typeof intervalId === "object" && "unref" in intervalId) {
    (intervalId as NodeJS.Timeout).unref();
  }
  (globalThis as Record<string, unknown>)[GLOBAL_MARKER] = intervalId;

  // Clean up on process exit to prevent leaks in serverless/long-running processes
  if (typeof process !== "undefined") {
    process.on("beforeExit", () => clearInterval(intervalId));
    process.on("SIGTERM", () => clearInterval(intervalId));
    process.on("SIGINT", () => clearInterval(intervalId));
  }
}

async function checkRedisLimit(
  client: Redis,
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + windowMs;
  const redisKey = `ratelimit:${key}`;

  // Use a single EVAL script for atomic increment + expiry
  // Returns [count, ttl_ms] where ttl_ms is -1 if no expiry set
  const script = `
    local count = redis.call("INCR", KEYS[1])
    local ttl = redis.call("PTTL", KEYS[1])
    if ttl < 0 then
      redis.call("PEXPIRE", KEYS[1], ARGV[1])
    end
    return {count, ttl}
  `;

  let result: [number, number];
  try {
    result = (await client.eval(script, 1, redisKey, String(windowMs))) as [number, number];
  } catch (error: unknown) {
    throw new Error(`Redis pipeline error in rate-limit check: ${error instanceof Error ? error.message : String(error)}`);
  }

  const count = result[0] ?? 0;
  const remaining = Math.max(0, maxRequests - count);
  const limited = count > maxRequests;

  return {
    limited,
    remaining,
    limit: maxRequests,
    resetAt,
  };
}

function checkMemoryLimit(
  routeId: string,
  ip: string,
  userId: string | null,
  windowMs: number,
  maxRequests: number,
): RateLimitResult {
  const now = Date.now();
  const key = userId ? `user:${userId}` : `ip:${ip}`;
  const resetAt = now + windowMs;

  if (!memoryStores.has(routeId)) {
    memoryStores.set(routeId, new Map());
  }
  const store = memoryStores.get(routeId) as Map<string, MemoryEntry>;

  // FIFO eviction if store is too large
  if (store.size >= MAX_MEMORY_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }

  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt };
    store.set(key, entry);
  }

  const limited = entry.count >= maxRequests;
  if (!limited) {
    entry.count++;
  }

  const remaining = Math.max(0, maxRequests - entry.count);

  return {
    limited,
    remaining,
    limit: maxRequests,
    resetAt: entry.resetAt,
  };
}

// Build rate limit response headers
function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { error: "Слишком много запросов. Пожалуйста, повторите позже." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfter)),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.resetAt),
      },
    },
  );
}

// Sync rate limiter (uses in-memory, returns null or 429 response)
// This maintains backward compatibility with existing API routes
export function rateLimit(
  routeId: string,
  config: Partial<RateLimitConfig> = {},
) {
  const { windowMs, maxRequests } = { ...defaultConfig, ...config };

  return (request: Request, userId?: string | null): NextResponse | null => {
    const ip = getClientIp(request);
    const effectiveUserId = userId ?? null;

    const result = checkMemoryLimit(routeId, ip, effectiveUserId, windowMs, maxRequests);

    if (result.limited) {
      return createRateLimitResponse(result);
    }

    // Attach rate limit headers to the response via a custom header that middleware can read
    // This is a no-op for the sync limiter since we can't modify the response after creation
    return null;
  };
}

// Helper to add rate limit headers to any response
export function addRateLimitHeaders(
  headers: Headers,
  routeId: string,
  request: Request,
  userId?: string | null,
): void {
  const config = RATE_LIMITS[routeId as keyof typeof RATE_LIMITS] ?? RATE_LIMITS.default;
  const { windowMs, maxRequests } = { ...defaultConfig, ...config };
  const ip = getClientIp(request);
  const effectiveUserId = userId ?? null;

  const result = checkMemoryLimit(routeId, ip, effectiveUserId, windowMs, maxRequests);

  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(result.resetAt));
  headers.set("X-RateLimit-Window", String(windowMs));
}

// Async rate limiter (uses Redis when available, falls back to in-memory)
// Use this in API routes that can handle async operations
export async function rateLimitAsync(
  routeId: string,
  request: Request,
  config: Partial<RateLimitConfig> & { userId?: string | null } = {},
): Promise<{ response: NextResponse | null; headers: Record<string, string> }> {
  const { windowMs, maxRequests, userId } = { ...defaultConfig, userId: null as string | null, ...config };
  const ip = getClientIp(request);
  const key = userId ? `user:${userId}:${routeId}` : `ip:${ip}:${routeId}`;

  const redis = getRedisClient();
  let result: RateLimitResult;

  if (redis) {
    try {
      result = await checkRedisLimit(redis, key, windowMs, maxRequests);
    } catch (error: unknown) {
      log.warn("Redis rate check failed, falling back to memory", {
        error: error instanceof Error ? error.message : String(error),
      });
      result = checkMemoryLimit(routeId, ip, userId, windowMs, maxRequests);
    }
  } else {
    result = checkMemoryLimit(routeId, ip, userId, windowMs, maxRequests);
  }

  const headers = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };

  if (result.limited) {
    return {
      response: createRateLimitResponse(result),
      headers,
    };
  }

  return { response: null, headers };
}

export const RATE_LIMITS = {
  register: { windowMs: 60_000, maxRequests: 5 },
  forgotPassword: { windowMs: 60_000, maxRequests: 3 },
  resetPassword: { windowMs: 60_000, maxRequests: 5 },
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
  sendVerification: { windowMs: 60_000, maxRequests: 3 },
  sse: { windowMs: 60_000, maxRequests: 5 },
  default: { windowMs: 60_000, maxRequests: 30 },
} as const;
