import Redis from "ioredis";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";

// Redis client for caching (reuses connection from rate-limit if possible)
let cacheClient: Redis | null = null;
let cacheConnectionFailed = false;
let reconnectTimeout: NodeJS.Timeout | null = null;
const RECONNECT_DELAY_MS = 30_000; // 30 seconds between reconnect attempts

function scheduleReconnect(): void {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    cacheConnectionFailed = false;
    log.info("Attempting to reconnect Redis cache");
    // Force recreation on next getCacheClient call
    if (cacheClient) {
      cacheClient.disconnect();
      cacheClient = null;
    }
  }, RECONNECT_DELAY_MS);
}

function getCacheClient(): Redis | null {
  if (cacheConnectionFailed) return null;
  if (cacheClient) return cacheClient;

  const redisUrl = env.redisUrl;
  if (!redisUrl) return null;

  try {
    cacheClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 3000,
      lazyConnect: true,
      keyPrefix: "cache:",
    });

    cacheClient.on("error", (error) => {
      log.warn("Redis cache connection error, scheduling reconnect", {
        error: error.message,
      });
      cacheConnectionFailed = true;
      cacheClient?.disconnect();
      cacheClient = null;
      scheduleReconnect();
    });

    cacheClient.on("ready", () => {
      if (cacheConnectionFailed) {
        log.info("Redis cache connection restored");
        cacheConnectionFailed = false;
      }
    });

    return cacheClient;
  } catch {
    cacheConnectionFailed = true;
    scheduleReconnect();
    return null;
  }
}

// In-memory fallback cache
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();
const MAX_MEMORY_CACHE_ENTRIES = 1000;

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
  tags?: string[]; // Tags for cache invalidation
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getCacheClient();

  if (redis) {
    try {
      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (error) {
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

  const redis = getCacheClient();

  if (redis) {
    try {
      await redis.setex(key, Math.ceil(ttl / 1000), JSON.stringify(data));

      // Store tags for invalidation
      if (tags?.length) {
        const tagKeys = tags.map((tag) => `tag:${tag}`);
        const pipeline = redis.pipeline();
        for (const tagKey of tagKeys) {
          pipeline.sadd(tagKey, key);
          pipeline.expire(tagKey, Math.ceil(ttl / 1000));
        }
        await pipeline.exec();
      }

      return true;
    } catch (error) {
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
  const redis = getCacheClient();

  if (redis) {
    try {
      await redis.del(key);
      return true;
    } catch {
      // ignore
    }
  }

  memoryCache.delete(key);
  return true;
}

export async function cacheInvalidateByTag(tag: string): Promise<boolean> {
  const redis = getCacheClient();

  if (redis) {
    try {
      const tagKey = `tag:${tag}`;
      const keys = await redis.smembers(tagKey);
      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        for (const key of keys) {
          pipeline.del(key);
        }
        pipeline.del(tagKey);
        await pipeline.exec();
      }
      return true;
    } catch (error) {
      log.warn("Redis cache invalidate by tag failed", {
        tag,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Memory cache doesn't support tags
  return false;
}

export function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);

  const paramString = JSON.stringify(sortedParams);
  return `${prefix}:${Buffer.from(paramString).toString("base64url").substring(0, 32)}`;
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
