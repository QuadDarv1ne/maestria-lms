import { describe, expect, it } from "vitest";
import {
  evaluateAdminIpAccess,
  isAdminIpAllowed,
  isAdminPath,
  parseAdminIpAllowlist,
  parseAdminIpEnforcement,
  resolveClientIp,
} from "./admin-ip-allowlist";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("parseAdminIpAllowlist", () => {
  it("treats an unset value as no restriction", () => {
    expect(parseAdminIpAllowlist(undefined)).toEqual({ mode: "disabled" });
    expect(parseAdminIpAllowlist(null)).toEqual({ mode: "disabled" });
    expect(parseAdminIpAllowlist("")).toEqual({ mode: "disabled" });
    expect(parseAdminIpAllowlist("   ")).toEqual({ mode: "disabled" });
  });

  it("accepts a single address", () => {
    expect(parseAdminIpAllowlist("203.0.113.7")).toEqual({
      mode: "enforced",
      entries: ["203.0.113.7"],
      invalid: [],
    });
  });

  it("splits on commas, semicolons and whitespace", () => {
    const policy = parseAdminIpAllowlist(" 10.0.0.0/8 ,192.168.1.0/24; 203.0.113.7 ");
    expect(policy.mode).toBe("enforced");
    if (policy.mode !== "enforced") return;
    expect(policy.entries).toEqual(["10.0.0.0/8", "192.168.1.0/24", "203.0.113.7"]);
  });

  it("skips blank segments and comments", () => {
    const policy = parseAdminIpAllowlist("10.0.0.0/8, , #office\n,203.0.113.7");
    expect(policy.mode).toBe("enforced");
    if (policy.mode !== "enforced") return;
    expect(policy.entries).toEqual(["10.0.0.0/8", "203.0.113.7"]);
  });

  it("keeps valid entries and reports the broken ones", () => {
    const policy = parseAdminIpAllowlist("10.0.0.0/8,10.0.0.300,office");
    expect(policy.mode).toBe("enforced");
    if (policy.mode !== "enforced") return;
    expect(policy.entries).toEqual(["10.0.0.0/8"]);
    expect(policy.invalid).toEqual(["10.0.0.300", "office"]);
  });

  it("reports invalid mode when nothing parses", () => {
    expect(parseAdminIpAllowlist("office")).toEqual({
      mode: "invalid",
      invalid: ["office"],
    });
  });

  it("rejects an out-of-range prefix", () => {
    expect(parseAdminIpAllowlist("10.0.0.0/33").mode).toBe("invalid");
    expect(parseAdminIpAllowlist("2001:db8::/129").mode).toBe("invalid");
  });

  it("accepts IPv6 and IPv4-mapped ranges", () => {
    const policy = parseAdminIpAllowlist("2001:db8::/32,::ffff:192.168.0.0/112");
    expect(policy.mode).toBe("enforced");
  });
});

describe("isAdminIpAllowed — IPv4", () => {
  const policy = parseAdminIpAllowlist("10.0.0.0/8,203.0.113.7");

  it("matches an address inside the range", () => {
    expect(isAdminIpAllowed("10.1.2.3", policy)).toBe(true);
  });

  it("matches an exact address", () => {
    expect(isAdminIpAllowed("203.0.113.7", policy)).toBe(true);
  });

  it("rejects an address outside every entry", () => {
    expect(isAdminIpAllowed("203.0.113.8", policy)).toBe(false);
    expect(isAdminIpAllowed("8.8.8.8", policy)).toBe(false);
  });

  it("honours the range boundary", () => {
    const narrow = parseAdminIpAllowlist("192.168.1.0/24");
    expect(isAdminIpAllowed("192.168.1.255", narrow)).toBe(true);
    expect(isAdminIpAllowed("192.168.2.0", narrow)).toBe(false);
  });

  it("treats /0 as everything", () => {
    const all = parseAdminIpAllowlist("0.0.0.0/0");
    expect(isAdminIpAllowed("8.8.8.8", all)).toBe(true);
  });

  it("rejects a missing or malformed client IP", () => {
    expect(isAdminIpAllowed(undefined, policy)).toBe(false);
    expect(isAdminIpAllowed("", policy)).toBe(false);
    expect(isAdminIpAllowed("not-an-ip", policy)).toBe(false);
    expect(isAdminIpAllowed("10.0.0.300", policy)).toBe(false);
  });
});

describe("isAdminIpAllowed — IPv6", () => {
  const policy = parseAdminIpAllowlist("2001:db8::/32");

  it("matches an address inside the range", () => {
    expect(isAdminIpAllowed("2001:db8::1", policy)).toBe(true);
    expect(isAdminIpAllowed("2001:db8:ffff:1::1", policy)).toBe(true);
  });

  it("rejects an address outside the range", () => {
    expect(isAdminIpAllowed("2001:db9::1", policy)).toBe(false);
  });

  it("matches a compressed address exactly", () => {
    const single = parseAdminIpAllowlist("2001:db8::dead:beef");
    expect(isAdminIpAllowed("2001:db8:0:0:0:0:dead:beef", single)).toBe(true);
  });

  it("compares IPv4-mapped clients as IPv4", () => {
    const v4 = parseAdminIpAllowlist("10.0.0.0/8");
    expect(isAdminIpAllowed("::ffff:10.1.2.3", v4)).toBe(true);
    expect(isAdminIpAllowed("::ffff:8.8.8.8", v4)).toBe(false);
  });

  it("does not let a v4 range match a real v6 client", () => {
    const v4 = parseAdminIpAllowlist("10.0.0.0/8");
    expect(isAdminIpAllowed("2001:db8::1", v4)).toBe(false);
  });

  it("strips a zone index", () => {
    const linkLocal = parseAdminIpAllowlist("fe80::/10");
    expect(isAdminIpAllowed("fe80::1%eth0", linkLocal)).toBe(true);
  });
});

describe("isAdminIpAllowed — policy modes", () => {
  it("allows everything when the allowlist is disabled", () => {
    expect(isAdminIpAllowed("8.8.8.8", { mode: "disabled" })).toBe(true);
    expect(isAdminIpAllowed(undefined, { mode: "disabled" })).toBe(true);
  });

  it("denies everything when the allowlist is unparseable", () => {
    expect(isAdminIpAllowed("8.8.8.8", { mode: "invalid", invalid: ["office"] })).toBe(false);
  });
});

describe("resolveClientIp", () => {
  it("takes the first hop of X-Forwarded-For", () => {
    expect(resolveClientIp(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
  });

  it("falls back to X-Real-IP", () => {
    expect(resolveClientIp(headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("prefers X-Forwarded-For over X-Real-IP", () => {
    expect(
      resolveClientIp(headers({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.1" })),
    ).toBe("203.0.113.7");
  });

  it("drops a port from an IPv4 address", () => {
    expect(resolveClientIp(headers({ "x-forwarded-for": "203.0.113.7:51234" }))).toBe(
      "203.0.113.7",
    );
  });

  it("unwraps a bracketed IPv6 address", () => {
    expect(resolveClientIp(headers({ "x-forwarded-for": "[2001:db8::1]:443" }))).toBe(
      "2001:db8::1",
    );
  });

  it("returns undefined when no header is present", () => {
    expect(resolveClientIp(headers({}))).toBeUndefined();
  });

  it("returns undefined for an empty header", () => {
    expect(resolveClientIp(headers({ "x-forwarded-for": "   " }))).toBeUndefined();
  });
});

describe("evaluateAdminIpAccess", () => {
  it("reports the disabled mode", () => {
    expect(evaluateAdminIpAccess("8.8.8.8", undefined)).toEqual({
      allowed: true,
      reason: "disabled",
    });
  });

  it("reports a match", () => {
    expect(evaluateAdminIpAccess("10.0.0.5", "10.0.0.0/8")).toEqual({
      allowed: true,
      reason: "matched",
    });
  });

  it("reports a mismatch", () => {
    expect(evaluateAdminIpAccess("8.8.8.8", "10.0.0.0/8")).toEqual({
      allowed: false,
      reason: "no-match",
    });
  });

  it("reports an unknown client IP", () => {
    expect(evaluateAdminIpAccess(undefined, "10.0.0.0/8")).toEqual({
      allowed: false,
      reason: "unknown-ip",
    });
  });

  it("reports a broken configuration instead of opening the panel", () => {
    expect(evaluateAdminIpAccess("10.0.0.5", "office")).toEqual({
      allowed: false,
      reason: "invalid-config",
    });
  });

  it("warn mode lets a non-matching client through and reports what it would do", () => {
    expect(evaluateAdminIpAccess("8.8.8.8", "10.0.0.0/8", "warn")).toEqual({
      allowed: true,
      reason: "would-block",
      wouldBlock: "no-match",
    });
  });

  it("warn mode covers an undeterminable IP", () => {
    expect(evaluateAdminIpAccess(undefined, "10.0.0.0/8", "warn")).toEqual({
      allowed: true,
      reason: "would-block",
      wouldBlock: "unknown-ip",
    });
  });

  it("warn mode still refuses a broken configuration", () => {
    expect(evaluateAdminIpAccess("10.0.0.5", "office", "warn")).toEqual({
      allowed: true,
      reason: "would-block",
      wouldBlock: "invalid-config",
    });
  });

  it("warn mode does not invent a match", () => {
    expect(evaluateAdminIpAccess("10.0.0.5", "10.0.0.0/8", "warn")).toEqual({
      allowed: true,
      reason: "matched",
    });
  });

  it("an unset allowlist passes regardless of the mode", () => {
    expect(evaluateAdminIpAccess("8.8.8.8", undefined, "warn")).toEqual({
      allowed: true,
      reason: "disabled",
    });
  });
});

describe("parseAdminIpEnforcement", () => {
  it("recognises warn", () => {
    expect(parseAdminIpEnforcement("warn")).toBe("warn");
    expect(parseAdminIpEnforcement(" WARN ")).toBe("warn");
  });

  it("treats anything else as enforce", () => {
    expect(parseAdminIpEnforcement(undefined)).toBe("enforce");
    expect(parseAdminIpEnforcement("")).toBe("enforce");
    expect(parseAdminIpEnforcement("enforce")).toBe("enforce");
    // A typo must not weaken the filter.
    expect(parseAdminIpEnforcement("one")).toBe("enforce");
  });
});

describe("isAdminPath", () => {
  it("covers the admin UI and API", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users")).toBe(true);
    expect(isAdminPath("/api/admin/audit-logs")).toBe(true);
    expect(isAdminPath("/api/admin")).toBe(true);
  });

  it("does not catch look-alike paths", () => {
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/api/adminx")).toBe(false);
    expect(isAdminPath("/courses")).toBe(false);
    expect(isAdminPath("/")).toBe(false);
  });
});
