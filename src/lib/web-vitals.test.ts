// @vitest-environment node
/**
 * Unit tests for Core Web Vitals aggregation (src/lib/web-vitals.ts).
 *
 * The Redis stand-in keeps a sorted set per metric where the score is the
 * collection timestamp — mirroring production, so the age-window and
 * rank-based trimming logic is exercised for real rather than mocked away.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { state } = vi.hoisted(() => {
  // key -> Map<member, score>
  const sorted = new Map<string, Map<string, number>>();

  function zset(key: string): Map<string, number> {
    let z = sorted.get(key);
    if (!z) {
      z = new Map();
      sorted.set(key, z);
    }
    return z;
  }

  function ranked(key: string): Array<[string, number]> {
    return [...zset(key).entries()].sort((a, b) => a[1] - b[1]);
  }

  const redis = {
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      const z = zset(key);
      const isNew = !z.has(member);
      z.set(member, Number(score));
      return isNew ? 1 : 0;
    }),
    zcard: vi.fn(async (key: string) => zset(key).size),
    zremrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      const z = zset(key);
      let removed = 0;
      for (const [member, score] of [...z.entries()]) {
        if (score >= Number(min) && score <= Number(max)) {
          z.delete(member);
          removed += 1;
        }
      }
      return removed;
    }),
    zremrangebyrank: vi.fn(async (key: string, start: number, stop: number) => {
      const all = ranked(key);
      const from = start < 0 ? Math.max(0, all.length + start) : start;
      const to = stop < 0 ? all.length + stop : stop;
      const slice = all.slice(from, to + 1);
      const z = zset(key);
      for (const [member] of slice) z.delete(member);
      return slice.length;
    }),
    zrangebyscore: vi.fn(async (key: string, min: number | string, max: number | string) => {
      const lo = min === "-inf" ? -Infinity : Number(min);
      const hi = max === "+inf" ? Infinity : Number(max);
      return ranked(key)
        .filter(([, score]) => score >= lo && score <= hi)
        .map(([member]) => member);
    }),
    del: vi.fn(async (...keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        if (sorted.delete(key)) removed += 1;
      }
      return removed;
    }),
    pipeline: vi.fn(() => {
      const ops: Array<() => Promise<unknown>> = [];
      const pipe = {
        zadd: (key: string, score: number, member: string) => {
          ops.push(() => redis.zadd(key, score, member));
          return pipe;
        },
        exec: async () => {
          for (const op of ops) await op();
          return [];
        },
      };
      return pipe;
    }),
  };

  return {
    state: {
      redis,
      sorted,
      reset() {
        sorted.clear();
        for (const fn of Object.values(redis)) {
          if (typeof fn === "function" && "mockClear" in fn) {
            (fn as { mockClear: () => void }).mockClear();
          }
        }
      },
    },
  };
});

const { mockGetRedisClient } = vi.hoisted(() => ({
  mockGetRedisClient: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({ getRedisClient: () => mockGetRedisClient() }));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  MAX_BATCH,
  MAX_SAMPLES,
  SAMPLE_TTL_MS,
  WEB_VITAL_NAMES,
  getWebVitalsSummary,
  normalizeSample,
  parseMemberValue,
  recordWebVitals,
  resetWebVitals,
  trimWebVitals,
} from "@/lib/web-vitals";

beforeEach(() => {
  state.reset();
  mockGetRedisClient.mockReturnValue(state.redis);
});

describe("normalizeSample", () => {
  it("accepts a well-formed sample", () => {
    expect(normalizeSample({ name: "LCP", value: 1234.5, rating: "good", path: "/catalog" })).toEqual({
      name: "LCP",
      value: 1234.5,
      rating: "good",
      path: "/catalog",
    });
  });

  it("coerces a numeric string value", () => {
    expect(normalizeSample({ name: "CLS", value: "0.05" })?.value).toBe(0.05);
  });

  it("rejects unknown metric names", () => {
    expect(normalizeSample({ name: "FID", value: 10 })).toBeNull();
    expect(normalizeSample({ name: "lcp", value: 10 })).toBeNull();
    expect(normalizeSample({ name: 42, value: 10 })).toBeNull();
  });

  it("rejects non-finite and negative values", () => {
    expect(normalizeSample({ name: "LCP", value: Number.NaN })).toBeNull();
    expect(normalizeSample({ name: "LCP", value: Infinity })).toBeNull();
    expect(normalizeSample({ name: "LCP", value: -1 })).toBeNull();
    expect(normalizeSample({ name: "LCP", value: "abc" })).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(normalizeSample(null)).toBeNull();
    expect(normalizeSample("LCP")).toBeNull();
    expect(normalizeSample(undefined)).toBeNull();
  });

  it("drops over-long path/rating and strips the member separator", () => {
    const sample = normalizeSample({
      name: "TTFB",
      value: 300,
      path: `/x:y:${"a".repeat(400)}`,
      rating: "r".repeat(64),
    });
    expect(sample?.path).toBeUndefined();
    expect(sample?.rating).toBeUndefined();

    const short = normalizeSample({ name: "TTFB", value: 300, path: "/a:b", rating: "go:od" });
    expect(short?.path).toBe("/a_b");
    expect(short?.rating).toBe("go_od");
  });
});

describe("parseMemberValue", () => {
  it("reads the value from the first field", () => {
    expect(parseMemberValue("1234.5:good:/catalog:uuid")).toBe(1234.5);
    expect(parseMemberValue("0.05:-:-:uuid")).toBe(0.05);
  });

  it("returns null for a malformed member", () => {
    expect(parseMemberValue("abc:good:/x:uuid")).toBeNull();
    expect(parseMemberValue("")).toBeNull();
  });
});

describe("recordWebVitals", () => {
  it("stores samples with the collection time as the score", async () => {
    const before = Date.now();
    const accepted = await recordWebVitals([{ name: "LCP", value: 2000, path: "/" }]);
    const after = Date.now();

    expect(accepted).toBe(1);
    const entries = [...(state.sorted.get("webvitals:LCP") ?? new Map()).entries()];
    expect(entries).toHaveLength(1);
    const [member, score] = entries[0];
    expect(member.startsWith("2000:")).toBe(true);
    expect(score).toBeGreaterThanOrEqual(before);
    expect(score).toBeLessThanOrEqual(after);
  });

  it("keeps duplicate values as separate samples", async () => {
    await recordWebVitals([{ name: "FCP", value: 900 }, { name: "FCP", value: 900 }]);
    expect(state.sorted.get("webvitals:FCP")?.size).toBe(2);
  });

  it("drops invalid entries but keeps the valid ones in the same batch", async () => {
    const accepted = await recordWebVitals([
      { name: "LCP", value: 1000 },
      { name: "NOPE", value: 1 },
      { name: "CLS", value: -1 },
      { name: "CLS", value: 0.2 },
    ]);
    expect(accepted).toBe(2);
    expect(state.sorted.get("webvitals:LCP")?.size).toBe(1);
    expect(state.sorted.get("webvitals:CLS")?.size).toBe(1);
  });

  it("caps a batch at MAX_BATCH", async () => {
    const batch = Array.from({ length: MAX_BATCH + 5 }, () => ({ name: "TTFB" as const, value: 100 }));
    const accepted = await recordWebVitals(batch);
    expect(accepted).toBe(MAX_BATCH);
    expect(state.sorted.get("webvitals:TTFB")?.size).toBe(MAX_BATCH);
  });

  it("returns 0 and does not throw when Redis is unavailable", async () => {
    mockGetRedisClient.mockReturnValue(null);
    await expect(recordWebVitals([{ name: "LCP", value: 100 }])).resolves.toBe(0);
  });

  it("swallows a pipeline failure", async () => {
    state.redis.pipeline.mockImplementationOnce(() => ({
      zadd: () => {
        throw new Error("redis down");
      },
      exec: async () => [],
    }) as never);

    await expect(recordWebVitals([{ name: "LCP", value: 100 }])).resolves.toBe(0);
  });
});

describe("trimWebVitals", () => {
  it("removes samples older than the retention window", async () => {
    const now = Date.now();
    const old = now - SAMPLE_TTL_MS - 1000;
    state.redis.zadd("webvitals:LCP", old, "1000:-:-:old");
    state.redis.zadd("webvitals:LCP", now, "2000:-:-:fresh");

    const removed = await trimWebVitals(now);

    expect(removed).toBe(1);
    const members = [...(state.sorted.get("webvitals:LCP") ?? new Map()).keys()];
    expect(members).toEqual(["2000:-:-:fresh"]);
  });

  it("drops the oldest excess above MAX_SAMPLES", async () => {
    const now = Date.now();
    for (let i = 0; i < MAX_SAMPLES + 25; i++) {
      state.redis.zadd("webvitals:INP", now - (MAX_SAMPLES + 25 - i) * 1000, `${i}:-:-:m${i}`);
    }

    const removed = await trimWebVitals(now);

    expect(removed).toBe(25);
    expect(state.sorted.get("webvitals:INP")?.size).toBe(MAX_SAMPLES);
    // the survivors are the newest ones
    const members = [...(state.sorted.get("webvitals:INP") ?? new Map()).keys()];
    expect(members).toContain(`${MAX_SAMPLES + 24}:-:-:m${MAX_SAMPLES + 24}`);
    expect(members).not.toContain("0:-:-:m0");
  });

  it("is a no-op when Redis is unavailable", async () => {
    mockGetRedisClient.mockReturnValue(null);
    await expect(trimWebVitals()).resolves.toBe(0);
  });
});

describe("getWebVitalsSummary", () => {
  it("reports enabled:false when Redis is not configured", async () => {
    mockGetRedisClient.mockReturnValue(null);
    const summary = await getWebVitalsSummary();

    expect(summary.enabled).toBe(false);
    expect(summary.totalSamples).toBe(0);
    expect(summary.metrics).toHaveLength(WEB_VITAL_NAMES.length);
    expect(summary.metrics.every((m) => m.p75 === null && !m.healthy)).toBe(true);
  });

  it("computes nearest-rank percentiles per metric", async () => {
    const now = Date.now();
    // 1..100 ms for LCP: p50 = 50, p75 = 75, p95 = 95
    for (let v = 1; v <= 100; v++) {
      state.redis.zadd("webvitals:LCP", now, `${v}:-:/:u${v}`);
    }

    const summary = await getWebVitalsSummary();
    const lcp = summary.metrics.find((m) => m.name === "LCP");

    expect(lcp).toMatchObject({ count: 100, p50: 50, p75: 75, p95: 95, goodThreshold: 2500, healthy: true });
  });

  it("marks a metric unhealthy when p75 exceeds the good threshold", async () => {
    const now = Date.now();
    for (const v of [3000, 4000, 5000]) {
      state.redis.zadd("webvitals:LCP", now, `${v}:-:/:u${v}`);
    }
    for (const v of [0.01, 0.02]) {
      state.redis.zadd("webvitals:CLS", now, `${v}:-:/:c${v}`);
    }

    const summary = await getWebVitalsSummary();
    expect(summary.metrics.find((m) => m.name === "LCP")?.healthy).toBe(false);
    expect(summary.metrics.find((m) => m.name === "CLS")?.healthy).toBe(true);
    expect(summary.totalSamples).toBe(5);
  });

  it("excludes samples outside the requested window", async () => {
    const now = Date.now();
    state.redis.zadd("webvitals:TTFB", now - 2 * 60 * 60 * 1000, "900:-:-:old");
    state.redis.zadd("webvitals:TTFB", now, "200:-:-:new");

    const summary = await getWebVitalsSummary({ windowMs: 60 * 60 * 1000 });
    const ttfb = summary.metrics.find((m) => m.name === "TTFB");

    expect(ttfb?.count).toBe(1);
    expect(ttfb?.p50).toBe(200);
  });

  it("ignores members with an unparsable value", async () => {
    const now = Date.now();
    state.redis.zadd("webvitals:INP", now, "abc:-:-:bad");
    state.redis.zadd("webvitals:INP", now, "150:-:-:good");

    const summary = await getWebVitalsSummary();
    expect(summary.metrics.find((m) => m.name === "INP")?.count).toBe(1);
  });

  it("returns an empty but enabled summary when a read fails", async () => {
    state.redis.zrangebyscore.mockRejectedValueOnce(new Error("boom"));

    const summary = await getWebVitalsSummary();
    expect(summary.enabled).toBe(true);
    expect(summary.totalSamples).toBe(0);
  });
});

describe("resetWebVitals", () => {
  it("deletes every metric key", async () => {
    const now = Date.now();
    for (const name of WEB_VITAL_NAMES) {
      state.redis.zadd(`webvitals:${name}`, now, `100:-:-:${name}`);
    }

    await resetWebVitals();

    expect(state.sorted.size).toBe(0);
    expect(state.redis.del).toHaveBeenCalledWith(
      ...WEB_VITAL_NAMES.map((name) => `webvitals:${name}`),
    );
  });

  it("is a no-op when Redis is unavailable", async () => {
    mockGetRedisClient.mockReturnValue(null);
    await expect(resetWebVitals()).resolves.toBeUndefined();
  });
});
