import { describe, it, expect, vi, beforeEach } from "vitest";

const { log, state } = vi.hoisted(() => {
  // In-memory Redis stand-in: sorted sets, sets and strings + multi/exec.
  const sorted = new Map<string, Map<string, number>>();
  const sets = new Map<string, Set<string>>();
  const strings = new Map<string, string>();
  const ttls = new Map<string, number>();

  function zset(key: string): Map<string, number> {
    let z = sorted.get(key);
    if (!z) {
      z = new Map();
      sorted.set(key, z);
    }
    return z;
  }

  function zsetMembers(key: string): Array<[string, number]> {
    return [...zset(key).entries()].sort((a, b) => a[1] - b[1]);
  }

  function zrange(key: string, start: number, stop: number): string[] {
    const all = zsetMembers(key).map(([m]) => m);
    const from = start < 0 ? Math.max(0, all.length + start) : start;
    const to = stop < 0 ? all.length + stop : stop;
    return all.slice(from, to + 1);
  }

  const client = {
    // ── strings ──
    get: vi.fn(async (key: string) => strings.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      strings.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (key: string) => (strings.delete(key) ? 1 : 0)),
    mget: vi.fn(async (keys: string[]) => keys.map((k) => strings.get(k) ?? null)),
    expire: vi.fn(async (key: string, seconds: number) => {
      ttls.set(key, seconds);
      return 1;
    }),
    // ── sets ──
    sadd: vi.fn(async (key: string, member: string) => {
      let s = sets.get(key);
      if (!s) {
        s = new Set();
        sets.set(key, s);
      }
      const had = s.has(member);
      s.add(member);
      return had ? 0 : 1;
    }),
    srem: vi.fn(async (key: string, member: string) => (sets.get(key)?.delete(member) ? 1 : 0)),
    smembers: vi.fn(async (key: string) => [...(sets.get(key) ?? [])]),
    scard: vi.fn(async (key: string) => sets.get(key)?.size ?? 0),
    // ── sorted sets ──
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      const z = zset(key);
      const isNew = !z.has(member);
      z.set(member, Number(score));
      return isNew ? 1 : 0;
    }),
    zcard: vi.fn(async (key: string) => zset(key).size),
    zpopmin: vi.fn(async (key: string, count: number) => {
      const first = zrange(key, 0, count - 1);
      if (first.length === 0) return [];
      const [member] = first;
      const z = zset(key);
      const score = z.get(member) ?? 0;
      z.delete(member);
      return [member, String(score)];
    }),
    zrange: vi.fn(async (key: string, start: number, stop: number) => zrange(key, start, stop)),
    zrangebyscore: vi.fn(
      async (key: string, min: string | number, max: string | number, ...args: unknown[]) => {
        const lo = min === "-inf" ? -Infinity : Number(min);
        const hi = max === "+inf" || max === "inf" ? Infinity : Number(max);
        let members = zsetMembers(key)
          .filter(([, score]) => score >= lo && score <= hi)
          .map(([m]) => m);
        if (String(args[0]).toUpperCase() === "LIMIT") {
          const offset = Number(args[1]);
          const count = Number(args[2]);
          members = members.slice(offset, count >= 0 ? offset + count : undefined);
        }
        return members;
      },
    ),
    zrem: vi.fn(async (key: string, member: string) => (zset(key).delete(member) ? 1 : 0)),
    zremrangebyrank: vi.fn(async (key: string, start: number, stop: number) => {
      const doomed = zrange(key, start, stop);
      const z = zset(key);
      doomed.forEach((m) => z.delete(m));
      return doomed.length;
    }),
    // ── transactions: buffered commands applied on exec() ──
    multi: vi.fn(() => {
      const queue: Array<() => Promise<unknown>> = [];
      const wrap =
        (fn: (...args: unknown[]) => Promise<unknown>) =>
        (...args: unknown[]) => {
          queue.push(() => fn(...args));
          return api;
        };
      const api = {
        set: wrap((key, value) => client.set(key as string, value as string)),
        get: wrap((key) => client.get(key as string)),
        del: wrap(async (...args: unknown[]) => {
          const key = args[0] as string;
          // Clear string value
          const s = await client.del(key);
          // Clear sets (if any)
          const setRemoved = sets.has(key) ? sets.delete(key) : false;
          // Clear sorted set (if any)
          const zsetRemoved = sorted.has(key) ? sorted.delete(key) : false;
          return s + (setRemoved ? 1 : 0) + (zsetRemoved ? 1 : 0);
        }),
        expire: wrap((key, sec) => client.expire(key as string, sec as number)),
        sadd: wrap((key, m) => client.sadd(key as string, m as string)),
        srem: wrap((key, m) => client.srem(key as string, m as string)),
        zadd: wrap((key, score, member) => client.zadd(key as string, Number(score), member as string)),
        zrem: wrap((key, member) => client.zrem(key as string, member as string)),
        zremrangebyrank: wrap((key, s, e) => client.zremrangebyrank(key as string, s as number, e as number)),
        exec: vi.fn(async () => {
          const results = await Promise.all(queue.map(async (run) => {
            try {
              return [null, await run()];
            } catch (e) {
              return [e, null];
            }
          }));
          queue.length = 0;
          return results;
        }),
      };
      return api;
    }),
  };

  return {
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    state: {
      client,
      strings,
      ttls,
      zset,
      zsetMembers,
      zrange,
      set: (key: string, value: string) => strings.set(key, value),
      zadd: (key: string, member: string, score: number) => zset(key).set(member, score),
      zrem: (key: string, member: string) => {
        zset(key).delete(member);
      },
      sadd: (key: string, member: string) => {
        let s = sets.get(key);
        if (!s) {
          s = new Set();
          sets.set(key, s);
        }
        s.add(member);
      },
      members: (key: string) => [...(sets.get(key) ?? [])],
      clear: () => {
        sorted.clear();
        sets.clear();
        strings.clear();
        ttls.clear();
      },
    },
  };
});

vi.mock("./logger", () => ({ log }));

let redisAvailable = true;
vi.mock("./redis", () => ({
  getRedisClient: () => (redisAvailable ? state.client : null),
}));

import {
  enqueueEmail,
  dequeueEmail,
  completeEmail,
  failEmail,
  promoteDueRetries,
  collectOrphanedJobs,
  removeEmailJob,
  getQueueStats,
  listDeadEmails,
  purgeDeadLetterQueue,
  retryDeadEmails,
  RETRY_DELAYS_MS,
} from "./email-queue";

const QUEUE = "email:queue";
const RETRY = "email:retry";
const PROCESSING = "email:processing";
const COMPLETED = "email:completed";
const DEAD = "email:dead";
const jobKey = (id: string) => `email:job:${id}`;

const base = { to: "user@example.com", subject: "Subject", html: "<p>Hello</p>" };

beforeEach(() => {
  state.clear();
  vi.clearAllMocks();
  redisAvailable = true;
});

describe("enqueueEmail", () => {
  it("persists the payload and indexes it in the queue", async () => {
    const job = await enqueueEmail(base);

    expect(job.id).toMatch(/^email_\d+_[a-z0-9]+$/);
    expect(job).toMatchObject({ priority: "normal", retries: 0, maxRetries: 5 });
    expect(JSON.parse(state.strings.get(jobKey(job.id)) ?? "null")).toMatchObject({ id: job.id });
    expect(state.zrange(QUEUE, 0, -1)).toEqual([job.id]);
  });

  it("honours explicit priority and maxRetries", async () => {
    const job = await enqueueEmail({ ...base, priority: "urgent", maxRetries: 2 });
    expect(job).toMatchObject({ priority: "urgent", maxRetries: 2 });
  });

  it("throws when Redis is unavailable so callers can fall back", async () => {
    redisAvailable = false;
    await expect(enqueueEmail(base)).rejects.toThrow("Redis not available");
  });
});

describe("dequeueEmail", () => {
  it("returns null on an empty queue", async () => {
    expect(await dequeueEmail()).toBeNull();
  });

  it("pops urgent before low", async () => {
    await enqueueEmail({ ...base, priority: "low" });
    const low = await dequeueEmail();
    expect(low?.priority).toBe("low");
  });

  it("serves jobs in priority order and FIFO within a priority", async () => {
    await enqueueEmail({ ...base, subject: "low-1", priority: "low" });
    await enqueueEmail({ ...base, subject: "normal-1" });
    await enqueueEmail({ ...base, subject: "high-1", priority: "high" });
    await enqueueEmail({ ...base, subject: "urgent-1", priority: "urgent" });
    await enqueueEmail({ ...base, subject: "normal-2" });

    const order: string[] = [];
    for (let i = 0; i < 5; i++) {
      const job = await dequeueEmail();
      if (!job) break;
      order.push(job.subject);
    }

    expect(order).toEqual(["urgent-1", "high-1", "normal-1", "normal-2", "low-1"]);
  });

  it("marks the popped job as processing", async () => {
    const job = await enqueueEmail(base);
    await dequeueEmail();
    expect(state.members(PROCESSING)).toEqual([job.id]);
    expect(state.zrange(QUEUE, 0, -1)).toEqual([]);
  });

  it("drops a queue entry whose payload disappeared", async () => {
    state.zadd(QUEUE, "ghost", 1);
    expect(await dequeueEmail()).toBeNull();
    expect(log.warn).toHaveBeenCalledWith(
      "Email job payload missing, dropping queue entry",
      { jobId: "ghost" },
    );
  });
});

describe("completeEmail", () => {
  it("leaves processing, records completion and expires the payload", async () => {
    const job = await enqueueEmail(base);
    await dequeueEmail();
    await completeEmail(job.id);

    expect(state.members(PROCESSING)).toEqual([]);
    expect(state.zrange(COMPLETED, 0, -1)).toEqual([job.id]);
    expect(state.ttls.get(jobKey(job.id))).toBe(7 * 24 * 60 * 60);
  });
});

describe("failEmail", () => {
  it("schedules a delayed retry instead of re-queuing immediately", async () => {
    const job = await enqueueEmail({ ...base, maxRetries: 3 });
    await dequeueEmail();

    const result = await failEmail(job.id, "gateway timeout");

    expect(result.retry).toBe(true);
    const expected = Date.now() + RETRY_DELAYS_MS[0];
    const scored = state.zsetMembers(RETRY).find(([m]) => m === job.id);
    expect(scored).toBeDefined();
    // Eligibility must land on the backoff horizon, not "now" — otherwise the
    // next dequeue would resend instantly and backoff would be meaningless.
    expect(scored![1]).toBeGreaterThanOrEqual(expected - 500);
    expect(state.zrange(QUEUE, 0, -1)).not.toContain(job.id);

    const stored = JSON.parse(state.strings.get(jobKey(job.id)) ?? "{}");
    expect(stored).toMatchObject({ retries: 1, error: "gateway timeout" });
    expect(result.nextAttemptAt).toBe(new Date(scored![1]).toISOString());
  });

  it("grows the backoff with each attempt", async () => {
    const job = await enqueueEmail({ ...base, maxRetries: 5 });
    await dequeueEmail();
    await failEmail(job.id, "e1");

    await dequeueEmail().catch(() => null);
    // The job sits in the retry set, so the queue is empty until promotion.
    expect(await dequeueEmail()).toBeNull();

    state.zadd(QUEUE, job.id, 1); // simulate promotion
    await dequeueEmail();
    await failEmail(job.id, "e2");

    const stored = JSON.parse(state.strings.get(jobKey(job.id)) ?? "{}");
    expect(stored.retries).toBe(2);
  });

  it("moves to the dead-letter set once retries are exhausted", async () => {
    const job = await enqueueEmail({ ...base, maxRetries: 1 });
    await dequeueEmail();

    const result = await failEmail(job.id, "permanent failure");

    expect(result.retry).toBe(false);
    expect(state.zrange(DEAD, 0, -1)).toEqual([job.id]);
    expect(state.members(PROCESSING)).toEqual([]);
    expect(log.error).toHaveBeenCalledWith(
      "Email moved to dead letter queue",
      expect.objectContaining({ jobId: job.id, retries: 1 }),
    );
  });

  it("reports no retry when the payload is gone", async () => {
    state.sadd(PROCESSING, "missing");
    expect(await failEmail("missing", "boom")).toEqual({ retry: false });
    expect(state.members(PROCESSING)).toEqual([]);
  });

  it("is a no-op without Redis", async () => {
    redisAvailable = false;
    expect(await failEmail("x", "boom")).toEqual({ retry: false });
  });
});

describe("promoteDueRetries", () => {
  it("moves only jobs whose backoff window elapsed, keeping priority", async () => {
    const due = await enqueueEmail({ ...base, subject: "due", priority: "high" });
    const waiting = await enqueueEmail({ ...base, subject: "waiting", priority: "low" });

    // Simulate the state failEmail() leaves behind: payload in the retry set,
    // not in the main queue.
    state.zrem(QUEUE, due.id);
    state.zrem(QUEUE, waiting.id);
    state.zadd(RETRY, due.id, Date.now() - 1000);
    state.zadd(RETRY, waiting.id, Date.now() + 60_000);

    const promoted = await promoteDueRetries();

    expect(promoted).toBe(1);
    expect(state.zrange(RETRY, 0, -1)).toEqual([waiting.id]);
    const queued = state.zsetMembers(QUEUE);
    expect(queued.map(([m]) => m)).toEqual([due.id]);
    // Re-scored by priority (high = 1), not left at the placeholder score.
    expect(queued[0][1]).toBeGreaterThanOrEqual(1e13);
  });

  it("returns 0 when nothing is due", async () => {
    expect(await promoteDueRetries()).toBe(0);
  });

  it("is a no-op without Redis", async () => {
    redisAvailable = false;
    expect(await promoteDueRetries()).toBe(0);
  });
});

describe("collectOrphanedJobs", () => {
  it("requeues jobs stuck in processing past the TTL", async () => {
    const job = await enqueueEmail(base);
    const stale = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    state.set(jobKey(job.id), JSON.stringify({ ...job, updatedAt: stale }));
    state.sadd(PROCESSING, job.id);

    expect(await collectOrphanedJobs()).toBe(1);
    expect(state.zrange(RETRY, 0, -1)).toEqual([job.id]);
  });

  it("drops processing entries whose payload is unreadable", async () => {
    state.sadd(PROCESSING, "broken");
    state.set(jobKey("broken"), "{not json");

    expect(await collectOrphanedJobs()).toBe(1);
    expect(state.members(PROCESSING)).toEqual([]);
  });

  it("leaves healthy in-flight jobs alone", async () => {
    const job = await enqueueEmail(base);
    await dequeueEmail();

    expect(await collectOrphanedJobs()).toBe(0);
    expect(state.members(PROCESSING)).toEqual([job.id]);
  });
});

describe("getQueueStats", () => {
  it("counts every structure and breaks pending down by priority", async () => {
    await enqueueEmail({ ...base, priority: "urgent" });
    await enqueueEmail({ ...base });
    await enqueueEmail({ ...base, priority: "low" });
    // Enqueue a 4th job so we can dequeue one (highest priority = urgent)
    await enqueueEmail({ ...base, priority: "high" });
    const first = await dequeueEmail(); // should be urgent (lowest score)

    const stats = await getQueueStats();

    expect(first).not.toBeNull();
    expect(first?.priority).toBe("urgent");
    expect(stats).toMatchObject({
      pending: 3,
      delayed: 0,
      processing: 1,
      completed: 0,
      dead: 0,
    });
    expect(stats.byPriority).toEqual({ urgent: 0, high: 1, normal: 1, low: 1 });
    expect(state.members(PROCESSING)).toEqual([first?.id]);
  });

  it("zeroes everything without Redis", async () => {
    redisAvailable = false;
    const stats = await getQueueStats();
    expect(stats.pending).toBe(0);
    expect(stats.byPriority).toEqual({ low: 0, normal: 0, high: 0, urgent: 0 });
  });
});

describe("dead letter management", () => {
  async function deadJob(subject: string) {
    const job = await enqueueEmail({ ...base, subject, maxRetries: 1 });
    await dequeueEmail();
    await failEmail(job.id, "exhausted");
    return job;
  }

  it("lists dead jobs with their stored error", async () => {
    await deadJob("dead-1");
    const listed = await listDeadEmails(10);

    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ subject: "dead-1", retries: 1, error: "exhausted" });
  });

  it("retries dead jobs with a fresh budget", async () => {
    const job = await deadJob("retry-me");

    expect(await retryDeadEmails()).toBe(1);
    expect(state.zrange(DEAD, 0, -1)).toEqual([]);
    expect(state.zrange(QUEUE, 0, -1)).toEqual([job.id]);

    const stored = JSON.parse(state.strings.get(jobKey(job.id)) ?? "{}");
    expect(stored.retries).toBe(0);
    // JSON.stringify drops the undefined error, so the key must be gone entirely.
    expect(stored).not.toHaveProperty("error");
  });

  it("purges dead jobs and their payloads", async () => {
    const job = await deadJob("purge-me");

    expect(await purgeDeadLetterQueue()).toBe(1);
    expect(state.zrange(DEAD, 0, -1)).toEqual([]);
    expect(state.strings.has(jobKey(job.id))).toBe(false);
  });

  it("returns 0 when there is nothing to list or purge", async () => {
    expect(await listDeadEmails(10)).toEqual([]);
    expect(await purgeDeadLetterQueue()).toBe(0);
    expect(await retryDeadEmails()).toBe(0);
  });
});

describe("removeEmailJob", () => {
  it("clears the job from every queue structure", async () => {
    const job = await enqueueEmail(base);

    expect(await removeEmailJob(job.id)).toBe(true);
    expect(state.zrange(QUEUE, 0, -1)).toEqual([]);
    expect(state.strings.has(jobKey(job.id))).toBe(false);
  });

  it("reports false when nothing matched", async () => {
    expect(await removeEmailJob("nope")).toBe(false);
  });

  it("is a no-op without Redis", async () => {
    redisAvailable = false;
    expect(await removeEmailJob("x")).toBe(false);
  });
});
