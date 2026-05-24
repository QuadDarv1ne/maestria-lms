import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const STORE_DIR = path.join(process.cwd(), ".rate-limit");
const CLEANUP_INTERVAL = 60_000;

function ensureStoreDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function getStorePath(routeId: string): string {
  return path.join(STORE_DIR, `${routeId}.json`);
}

function loadStore(routeId: string): Map<string, RateLimitEntry> {
  try {
    ensureStoreDir();
    const filePath = getStorePath(routeId);
    if (!fs.existsSync(filePath)) {
      return new Map();
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, RateLimitEntry>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function saveStore(routeId: string, store: Map<string, RateLimitEntry>) {
  try {
    ensureStoreDir();
    const record: Record<string, RateLimitEntry> = {};
    for (const [key, entry] of store) {
      record[key] = entry;
    }
    fs.writeFileSync(getStorePath(routeId), JSON.stringify(record), "utf-8");
  } catch {
    // Ignore write errors — rate limiting degradation is acceptable
  }
}

function cleanupExpiredEntries() {
  const now = Date.now();
  try {
    ensureStoreDir();
    const files = fs.readdirSync(STORE_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = path.join(STORE_DIR, file);
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw) as Record<string, RateLimitEntry>;
        let changed = false;
        for (const [key, entry] of Object.entries(parsed)) {
          if (entry.resetAt <= now) {
            delete parsed[key];
            changed = true;
          }
        }
        if (changed) {
          fs.writeFileSync(filePath, JSON.stringify(parsed), "utf-8");
        }
      } catch {
        // Skip corrupted files
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

// Store interval ID in globalThis so HMR/module reloads don't leak orphaned intervals
const GLOBAL_MARKER = "__rateLimitCleanupInterval";
if (typeof globalThis !== "undefined" && !(globalThis as Record<string, unknown>)[GLOBAL_MARKER]) {
  (globalThis as Record<string, unknown>)[GLOBAL_MARKER] = setInterval(
    cleanupExpiredEntries,
    CLEANUP_INTERVAL,
  );
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 30,
};

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

/**
 * Check if an IP is a valid public IP (not private, loopback, or reserved).
 * This prevents attackers from spoofing rate limits by sending fake
 * x-forwarded-for headers with private IPs.
 */
function isValidPublicIp(ip: string): boolean {
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);

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

  const ipv4MappedMatch = /^::ffff:(\d{1,3})\.(\d{1,3})/.exec(normalizedIp);
  if (ipv4MappedMatch) {
    const [, a, b] = ipv4MappedMatch.map(Number);
    if (a === 172 && b >= 16 && b <= 31) return false;
  }

  if (normalizedIp.startsWith("fc") || normalizedIp.startsWith("fd")) return false;
  if (normalizedIp.startsWith("fe8") || normalizedIp.startsWith("fe9") ||
      normalizedIp.startsWith("fea") || normalizedIp.startsWith("feb")) return false;

  return /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/.test(normalizedIp);
}

export function rateLimit(
  routeId: string,
  config: Partial<RateLimitConfig> = {},
) {
  const { windowMs, maxRequests } = { ...defaultConfig, ...config };

  return (request: Request): NextResponse | null => {
    const ip = getClientIp(request);
    const now = Date.now();
    const key = ip;

    const store = loadStore(routeId);
    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;
    store.set(key, entry);
    saveStore(routeId, store);

    if (entry.count > maxRequests) {
      return NextResponse.json(
        { error: "Слишком много запросов. Пожалуйста, повторите позже." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
          },
        },
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
