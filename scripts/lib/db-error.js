/**
 * Human-readable diagnostics for database failures in the CLI scripts.
 *
 * Prisma 7's client runtime crashes while formatting some errors: when the
 * underlying failure carries no source location (typical for connection
 * failures) its `getLocation` helper throws
 *
 *   TypeError: Cannot read properties of undefined (reading 'sep')
 *
 * which replaces the real cause. `node check-db.js` and the seed guard both hit
 * it, so an unreachable database reported a meaningless TypeError instead of
 * "cannot connect". These helpers keep the operator informed: the target host is
 * named, and a known Prisma formatter crash is labelled as such instead of being
 * passed through verbatim.
 */

const { maskDatabaseUrl } = require("./env-manager");

/** Prisma runtime crash that hides the original error. */
const PRISMA_FORMATTER_CRASH = /reading 'sep'/;

/**
 * Extract `host:port` from a connection URL without leaking credentials.
 * @param {string} [url]
 * @returns {string}
 */
function describeTarget(url) {
  if (!url) return "the configured database";
  if (url.startsWith("file:")) return url;
  try {
    const parsed = new URL(url);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.hostname}${port}`;
  } catch {
    return maskDatabaseUrl(url);
  }
}

/**
 * Turn an unknown database error into one actionable line.
 * @param {unknown} error
 * @param {string} [url] — the connection URL the operation used
 * @returns {string}
 */
function describeDatabaseError(error, url) {
  const target = describeTarget(url);
  const message = error && error.message ? String(error.message) : String(error);
  const code = error && error.code ? String(error.code) : "";

  if (PRISMA_FORMATTER_CRASH.test(message)) {
    return (
      `cannot reach or query the database at ${target} — ` +
      `the underlying error was masked by a Prisma runtime bug ` +
      `("${message}"). Check that the server is running, the host is correct ` +
      `and the credentials are valid.`
    );
  }

  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
    return `cannot reach the database at ${target} (${code}): ${message}`;
  }

  return code ? `${message} (${code})` : message;
}

module.exports = {
  describeTarget,
  describeDatabaseError,
  PRISMA_FORMATTER_CRASH,
};
