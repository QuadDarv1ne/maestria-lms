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

setInterval(cleanup, CLEANUP_INTERVAL);

const defaultConfig: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 30,
};

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "anonymous";
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

export function withRateLimit(
  handler: (request: Request, ...args: unknown[]) => Promise<NextResponse>,
  routeId: string,
  config: Partial<RateLimitConfig> = {}
) {
  const check = rateLimit(routeId, config);

  return async (request: Request, ...args: unknown[]): Promise<NextResponse> => {
    const blocked = check(request);
    if (blocked) return blocked;
    return handler(request, ...args);
  };
}

export const RATE_LIMITS = {
  register: { windowMs: 60_000, maxRequests: 5 },
  forgotPassword: { windowMs: 60_000, maxRequests: 3 },
  login: { windowMs: 60_000, maxRequests: 10 },
  admin: { windowMs: 60_000, maxRequests: 60 },
  upload: { windowMs: 60_000, maxRequests: 10 },
  payments: { windowMs: 60_000, maxRequests: 20 },
  enrollment: { windowMs: 60_000, maxRequests: 10 },
  default: { windowMs: 60_000, maxRequests: 30 },
} as const;
