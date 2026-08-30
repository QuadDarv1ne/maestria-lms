/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";

const { mockLevel } = vi.hoisted(() => ({ mockLevel: { current: "info" } }));

vi.mock("@/lib/env", () => ({
  env: {
    get logLevel() {
      return mockLevel.current;
    },
  },
}));

import { log } from "@/lib/logger";

function capture(
  level: "error" | "warn" | "info" | "debug",
): MockInstance<(...args: unknown[]) => void> {
  return vi.spyOn(console, level).mockImplementation(() => {});
}

function parse(spy: MockInstance<(...args: unknown[]) => void>): Record<string, unknown> {
  const raw = spy.mock.calls[0][0] as string;
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should not log when level is above configured threshold", () => {
    mockLevel.current = "error";
    const infoSpy = capture("info");
    const warnSpy = capture("warn");
    const errorSpy = capture("error");

    log.info("should not appear");
    log.warn("also suppressed");
    log.error("error appears");

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("should log debug/info when level is debug", () => {
    mockLevel.current = "debug";
    const debugSpy = capture("debug");
    const infoSpy = capture("info");

    log.debug("dbg");
    log.info("inf");

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("should output JSON entries with level, message and timestamp", () => {
    mockLevel.current = "info";
    const infoSpy = capture("info");

    log.info("hello", { a: 1 });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const entry = parse(infoSpy);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("hello");
    expect(entry.context).toEqual({ a: 1 });
    expect(typeof entry.timestamp).toBe("string");
  });

  it("should route warn and error to their console methods", () => {
    mockLevel.current = "debug";
    const warnSpy = capture("warn");
    const errorSpy = capture("error");

    log.warn("w");
    log.error("e");

    expect(parse(warnSpy).message).toBe("w");
    expect(parse(errorSpy).message).toBe("e");
  });

  it("should not crash JSON serialization on circular references", () => {
    mockLevel.current = "info";
    const infoSpy = capture("info");

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    log.info("circular", circular);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    // Fallback branch stringifies context via String() — must not throw.
    expect((infoSpy.mock.calls[0][0] as string).length).toBeGreaterThan(0);
  });
});
