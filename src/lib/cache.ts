import { log } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";

// In-memory fallback cache with TTL validation
const memoryCache = new Map<string, { data: unknown; expiresAt: number; tags?: string[] }>();
const MAX_MEMORY_CACHE_ENTRIES = 1000;
const MEMORY_CACHE_CLEANUP_INTERVAL = 300_000; // 5 minutes

// Periodic cleanup of expired entries to prevent memory leaks
let memoryCacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

function startMemoryCacheCleanup() {
  if (memoryCacheCleanupInterval) return;
  memoryCacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        memoryCache.delete(key);
      }
    }
  }, MEMORY_CACHE_CLEANUP_INTERVAL);
  if (memoryCacheCleanupInterval && typeof memoryCacheCleanupInterval === "object" && "unref" in memoryCacheCleanupInterval) {
    (memoryCacheCleanupInterval as NodeJS.Timeout).unref();
  }
}

startMemoryCacheCleanup();

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
  tags?: string[]; // Tags for cache invalidation
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();

  if (redis) {
    let data: string | null = null;
    try {
      data = await redis.get(`cache:${key}`);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (error: unknown) {
      log.warn("Redis cache get failed (possibly corrupted data)", {
        key,
        dataPreview: typeof data === "string" ? data.substring(0, 120) : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to memory cache
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  if (entry) {
    memoryCache.delete(key);
  }
  return null;
}

export async function cacheSet(
  key: string,
  data: unknown,
  options: CacheOptions = {},
): Promise<boolean> {
  const { ttl = DEFAULT_TTL, tags } = options;
  const expiresAt = Date.now() + ttl;

  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.setex(`cache:${key}`, Math.ceil(ttl / 1000), JSON.stringify(data));

      // Store tags for invalidation
      if (tags?.length) {
        const tagKeys = tags.map((tag) => `cache:tag:${tag}`);
        const pipeline = redis.pipeline();
        for (const tagKey of tagKeys) {
          // Store the prefixed key — the same one the entry is written under —
          // so tag invalidation can delete the real entry.
          pipeline.sadd(tagKey, `cache:${key}`);
          pipeline.expire(tagKey, Math.ceil(ttl / 1000));
        }
        await pipeline.exec();
      }

      return true;
    } catch (error: unknown) {
      log.warn("Redis cache set failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to memory cache
  if (memoryCache.size >= MAX_MEMORY_CACHE_ENTRIES) {
    // Evict oldest entry
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, { data, expiresAt, tags });
  return true;
}

export async function cacheInvalidateByTag(tag: string): Promise<boolean> {
  let removed = false;
  const redis = getRedisClient();

  if (redis) {
    try {
      const tagKey = `cache:tag:${tag}`;
      const keys = await redis.smembers(tagKey);
      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        for (const key of keys) {
          // Tag members are stored with the same "cache:" prefix the entry is
          // written under in cacheSet, so deleting them removes the real entry.
          pipeline.del(key);
        }
        pipeline.del(tagKey);
        await pipeline.exec();
        removed = true;
      }
    } catch (error: unknown) {
      log.warn("Redis cache invalidate by tag failed", {
        tag,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Memory fallback: entries carry their own tags, so invalidate them too.
  // Previously this path ignored tags entirely and returned false, leaving
  // stale list responses after Redis went down.
  for (const [cacheKey, entry] of memoryCache) {
    if (entry.tags?.includes(tag)) {
      memoryCache.delete(cacheKey);
      removed = true;
    }
  }

  return removed;
}

function toBase64Url(str: string): string {
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return Buffer.from(str).toString("base64url");
  }
  const bytes = new TextEncoder().encode(str);
  const binary = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);

  const paramString = JSON.stringify(sortedParams);
  // The full encoded parameter string participates in the key. Previously it
  // was truncated to 32 base64 chars (24 JSON bytes), so page/limit/search/
  // sortBy values collapsed onto one key for lists with leading null
  // filters — page 2 could be served the cached page-1 response.
  return `${prefix}:${toBase64Url(paramString)}`;
}

export async function flushAll(): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      // Use SCAN instead of KEYS to avoid blocking Redis
      let cursor = "0";
      const batchSize = 500; // Increased for better throughput
      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "cache:*", "COUNT", batchSize);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (error: unknown) {
      log.warn("Redis cache flush failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  memoryCache.clear();
}

/** Stop periodic memory cache cleanup (for testing) */
export function stopMemoryCacheCleanup(): void {
  if (memoryCacheCleanupInterval) {
    clearInterval(memoryCacheCleanupInterval);
    memoryCacheCleanupInterval = null;
  }
}

export function createCacheHeaders(
  maxAge: number,
  isPublic = true,
  staleWhileRevalidate?: number,
): Record<string, string> {
  const directives = [
    isPublic ? "public" : "private",
    `max-age=${maxAge}`,
  ];

  if (staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  return {
    "Cache-Control": directives.join(", "),
  };
}
