/**
 * Short-lived cache for the JWT callback's per-request DB lookup.
 *
 * `auth.ts` runs on every authenticated request, and re-reading the user row
 * each time is wasteful. This cache holds the three fields the callback needs
 * for a bounded window, and is deliberately its own module so that routes and
 * helpers that must drop an entry (password change, 2FA change, admin demotion,
 * account erasure) do not have to import `auth.ts` — and with it NextAuth.
 *
 * The TTL is a deliberate trade-off: a demoted admin keeps their old role for
 * up to five minutes unless the entry is invalidated explicitly. Every path
 * that changes one of the cached fields calls `invalidateJwtUserCache`, so the
 * delay only ever applies to changes made outside this process.
 */

export interface JwtUserCacheEntry {
  role: string;
  isActive: boolean;
  /** Credential epoch; see `User.sessionVersion` in schema.prisma. */
  sessionVersion: number;
}

interface StoredEntry extends JwtUserCacheEntry {
  expiresAt: number;
}

export const JWT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const JWT_CACHE_MAX = 500;

const jwtUserCache = new Map<string, StoredEntry>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of jwtUserCache.entries()) {
      if (entry.expiresAt <= now) {
        jwtUserCache.delete(key);
      }
    }
  }, 60_000);
  // Never keep the process alive just to expire cache entries.
  if (cleanupInterval && typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
    (cleanupInterval as NodeJS.Timeout).unref();
  }
}

startCleanup();

/** Cached snapshot for a user, or null when absent/expired. */
export function getJwtUserCache(userId: string): JwtUserCacheEntry | null {
  const entry = jwtUserCache.get(userId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    jwtUserCache.delete(userId);
    return null;
  }
  // Return a copy without the bookkeeping field: callers compare this against
  // the user row, and an internal timestamp has no meaning there.
  return {
    role: entry.role,
    isActive: entry.isActive,
    sessionVersion: entry.sessionVersion,
  };
}

export function setJwtUserCache(userId: string, data: JwtUserCacheEntry): void {
  if (jwtUserCache.size >= JWT_CACHE_MAX) {
    // FIFO eviction: the oldest insertion is the least likely to be reused.
    const firstKey = jwtUserCache.keys().next().value;
    if (firstKey) jwtUserCache.delete(firstKey);
  }
  jwtUserCache.set(userId, { ...data, expiresAt: Date.now() + JWT_CACHE_TTL });
}

/**
 * Drop the cached snapshot for one user.
 *
 * Called right after anything that changes the cached fields, so the next
 * request re-reads the row instead of trusting a stale answer.
 */
export function invalidateJwtUserCache(userId: string): void {
  jwtUserCache.delete(userId);
}
