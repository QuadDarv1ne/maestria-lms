/**
 * IP allowlist for the admin area.
 *
 * The admin panel is reachable from anywhere as long as the session cookie is
 * valid, so a single stolen admin password is enough to take over the LMS. An
 * optional allowlist (ADMIN_IP_ALLOWLIST) pins admin access to known networks
 * on top of authentication — a second factor that an attacker cannot phish.
 *
 * Deliberately not built on getClientIp() from src/lib/rate-limit.ts: that
 * helper discards private addresses (10/8, 172.16/12, 192.168/16, ::1) because
 * they make poor rate-limit buckets. For an allowlist those ranges are exactly
 * what an office NAT or a VPN hands out, so the filter would reject every
 * legitimate admin. Trust in X-Forwarded-For is the same (first hop, behind a
 * proxy that overwrites it).
 */

export type AdminIpPolicy =
  /** ADMIN_IP_ALLOWLIST is unset — no restriction, authentication alone decides. */
  | { mode: "disabled" }
  /** Configured but nothing parsed: every request is refused, and loudly. */
  | { mode: "invalid"; invalid: readonly string[] }
  | { mode: "enforced"; entries: readonly string[]; invalid: readonly string[] };

export type AdminIpDecision =
  | { allowed: true; reason: "disabled" | "matched" }
  /** Refused by the list, but warn mode let it through. */
  | { allowed: true; reason: "would-block"; wouldBlock: AdminDenialReason }
  | { allowed: false; reason: AdminDenialReason };


type AdminDenialReason = "invalid-config" | "unknown-ip" | "no-match";

/**
 * How a failed check is acted on. "warn" logs the refusal and lets the request
 * through, which is the only safe way to turn the filter on: when no proxy
 * forwards the client address the IP cannot be determined, and enforcing right
 * away would lock the administrator out of their own panel.
 */
export type AdminIpEnforcement = "enforce" | "warn";

/** Anything unrecognised means "enforce" — a typo must not weaken the filter. */
export function parseAdminIpEnforcement(raw: string | undefined | null): AdminIpEnforcement {
  return raw?.trim().toLowerCase() === "warn" ? "warn" : "enforce";
}

interface ParsedAddress {
  version: 4 | 6;
  value: bigint;
}

const IPV4_MAX = 0xffffffffn;
const IPV6_MAX = (1n << 128n) - 1n;

function parseIpv4(input: string): ParsedAddress | null {
  const parts = input.trim().split(".");
  if (parts.length !== 4) return null;

  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8n) | BigInt(octet);
  }
  return { version: 4, value };
}

/** Expand a trailing IPv4 group ("::ffff:192.168.0.1") into two hex groups. */
function expandEmbeddedIpv4(groups: string[]): string[] | null {
  if (groups.length === 0) return groups;
  const last = groups[groups.length - 1];
  if (!last.includes(".")) return groups;

  const v4 = parseIpv4(last);
  if (!v4) return null;
  const high = (v4.value >> 16n) & 0xffffn;
  const low = v4.value & 0xffffn;
  return [...groups.slice(0, -1), high.toString(16), low.toString(16)];
}

function parseIpv6(input: string): ParsedAddress | null {
  let address = input.trim().toLowerCase();
  if (address.startsWith("[") && address.endsWith("]")) {
    address = address.slice(1, -1);
  }
  // Zone index (fe80::1%eth0) carries no routing information we can compare.
  const zoneIndex = address.indexOf("%");
  if (zoneIndex >= 0) address = address.slice(0, zoneIndex);
  if (!address.includes(":")) return null;

  const halves = address.split("::");
  if (halves.length > 2) return null;

  const head = expandEmbeddedIpv4(halves[0] ? halves[0].split(":") : []);
  const tail =
    halves.length === 2 ? expandEmbeddedIpv4(halves[1] ? halves[1].split(":") : []) : [];
  if (!head || !tail) return null;

  // "::" collapses one or more zero groups; without it the address is complete.
  const missing = 8 - (head.length + tail.length);
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;

  const groups = [...head, ...Array.from({ length: missing }, () => "0"), ...tail];

  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }
  return { version: 6, value };
}

/** Strip brackets, ports and quotes that proxies like to attach to the address. */
function normalizeAddress(raw: string): string {
  const address = raw.trim().replace(/^"|"$/g, "");

  if (address.startsWith("[")) {
    const closing = address.indexOf("]");
    return closing > 0 ? address.slice(1, closing) : address;
  }

  // "1.2.3.4:5678" — only IPv4 carries a port this way; a bare IPv6 address
  // has several colons and must be left alone.
  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(address);
  return ipv4WithPort ? ipv4WithPort[1] : address;
}

function parseAddress(raw: string): ParsedAddress | null {
  const address = normalizeAddress(raw);
  return parseIpv4(address) ?? parseIpv6(address);
}

/**
 * IPv4-mapped IPv6 (::ffff:10.0.0.1) is what Node hands over for IPv4 clients
 * on a dual-stack socket. Compare it as the IPv4 address it really is, so a
 * "10.0.0.0/8" entry keeps working.
 */
function asComparable(address: ParsedAddress, targetVersion: 4 | 6): ParsedAddress {
  if (address.version === targetVersion) return address;
  if (targetVersion === 4 && address.version === 6) {
    if (address.value >> 32n === 0xffffn) {
      return { version: 4, value: address.value & IPV4_MAX };
    }
  }
  return address;
}

function parseEntry(entry: string): { address: ParsedAddress; prefix: number } | null {
  const slash = entry.indexOf("/");
  const rawAddress = slash >= 0 ? entry.slice(0, slash) : entry;
  const rawPrefix = slash >= 0 ? entry.slice(slash + 1) : undefined;

  const address = parseAddress(rawAddress);
  if (!address) return null;

  const maxPrefix = address.version === 4 ? 32 : 128;
  if (rawPrefix === undefined) return { address, prefix: maxPrefix };
  if (!/^\d{1,3}$/.test(rawPrefix)) return null;

  const prefix = Number(rawPrefix);
  if (prefix < 0 || prefix > maxPrefix) return null;
  return { address, prefix };
}

function maskFor(version: 4 | 6, prefix: number): bigint {
  const max = version === 4 ? IPV4_MAX : IPV6_MAX;
  const bits = version === 4 ? 32 : 128;
  if (prefix <= 0) return 0n;
  if (prefix >= bits) return max;
  const hostBits = BigInt(bits - prefix);
  return max ^ ((1n << hostBits) - 1n);
}

/**
 * Parse the raw env value. Entries are separated by commas, semicolons or
 * whitespace so a value pasted from a spreadsheet still works.
 */
export function parseAdminIpAllowlist(raw: string | undefined | null): AdminIpPolicy {
  const trimmed = raw?.trim();
  if (!trimmed) return { mode: "disabled" };

  const entries: string[] = [];
  const invalid: string[] = [];

  for (const candidate of trimmed.split(/[\s,;]+/)) {
    const entry = candidate.trim();
    if (!entry || entry.startsWith("#")) continue;
    if (parseEntry(entry)) {
      entries.push(entry);
    } else {
      invalid.push(entry);
    }
  }

  // A typo must not silently unlock the panel: configured-but-unparseable is
  // treated as "deny everyone" and reported, not as "no restriction".
  if (entries.length === 0) return { mode: "invalid", invalid };
  return { mode: "enforced", entries, invalid };
}

/** First hop of X-Forwarded-For, falling back to X-Real-IP. */
export function resolveClientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeAddress(first);
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return normalizeAddress(realIp);

  return undefined;
}

export function isAdminIpAllowed(clientIp: string | undefined, policy: AdminIpPolicy): boolean {
  if (policy.mode === "disabled") return true;
  if (policy.mode === "invalid") return false;
  if (!clientIp) return false;

  const address = parseAddress(clientIp);
  if (!address) return false;

  return policy.entries.some((entry) => {
    const parsed = parseEntry(entry);
    if (!parsed) return false;

    const comparable = asComparable(address, parsed.address.version);
    if (comparable.version !== parsed.address.version) return false;

    const mask = maskFor(parsed.address.version, parsed.prefix);
    return (comparable.value & mask) === (parsed.address.value & mask);
  });
}

/**
 * Decide a single admin request.
 *
 * `mode` comes from ADMIN_IP_ALLOWLIST_MODE and only softens refusals: in
 * "warn" a request that would be blocked is allowed and reported with
 * reason "would-block", so a deployment can confirm that the proxy really
 * forwards the client address before switching to "enforce".
 */
export function evaluateAdminIpAccess(
  clientIp: string | undefined,
  rawAllowlist: string | undefined,
  mode: AdminIpEnforcement = "enforce",
): AdminIpDecision {
  const policy = parseAdminIpAllowlist(rawAllowlist);

  if (policy.mode === "disabled") return { allowed: true, reason: "disabled" };

  let refusal: AdminDenialReason;
  if (policy.mode === "invalid") {
    refusal = "invalid-config";
  } else if (!clientIp) {
    refusal = "unknown-ip";
  } else if (isAdminIpAllowed(clientIp, policy)) {
    return { allowed: true, reason: "matched" };
  } else {
    refusal = "no-match";
  }

  if (mode === "enforce") return { allowed: false, reason: refusal };
  return { allowed: true, reason: "would-block", wouldBlock: refusal };
}

/** Paths covered by the allowlist: admin UI pages and admin API routes. */
export function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}
