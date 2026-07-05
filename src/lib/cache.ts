import { log } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";

// In-memory fallback cache
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();
const MAX_MEMORY_CACHE_ENTRIES = 1000;

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
  tags?: string[]; // Tags for cache invalidation
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const data = await redis.get(`cache:${key}`);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (error: unknown) {
      log.warn("Redis cache get failed", {
        key,
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
          pipeline.sadd(tagKey, key);
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
  memoryCache.set(key, { data, expiresAt });
  return true;
}

export async function cacheDelete(key: string): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.del(`cache:${key}`);
      return true;
    } catch (err) {
      log.warn("cacheDelete failed", { key, error: err instanceof Error ? err.message : String(err) });
    }
  }

  memoryCache.delete(key);
  return true;
}

export async function cacheInvalidateByTag(tag: string): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const tagKey = `cache:tag:${tag}`;
      const keys = await redis.smembers(tagKey);
      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        for (const key of keys) {
          pipeline.del(`cache:${key}`);
        }
        pipeline.del(tagKey);
        await pipeline.exec();
      }
      return true;
    } catch (error: unknown) {
      log.warn("Redis cache invalidate by tag failed", {
        tag,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Memory cache doesn't support tags
  return false;
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
  return `${prefix}:${toBase64Url(paramString).substring(0, 32)}`;
}

export async function flushAll(): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const keys = await redis.keys("cache:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error: unknown) {
      log.warn("Redis cache flush failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  memoryCache.clear();
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
