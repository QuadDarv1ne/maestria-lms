#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Env Manager — Unified Environment & Database Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Single source of truth for:
 *  - .env file parsing / writing
 *  - Database provider auto-detection
 *  - Available port scanning
 *  - Docker detection
 *  - Optimal configuration selection
 *
 *  Used by: setup.js, prisma-auto.js, db-setup.js
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require("fs");
const path = require("path");
const net = require("net");
const os = require("os");
const { execSync } = require("child_process");

// ─── Types (JSDoc for IntelliSense) ───

/**
 * @typedef {Object} DbConfig
 * @property {string} provider  - 'sqlite' | 'postgresql' | 'mongodb'
 * @property {string} url       - connection URL
 * @property {number} [port]    - server port
 * @property {string} [reason]  - why this was chosen
 * @property {boolean} [docker] - uses Docker?
 */

/**
 * @typedef {Object} PortConfig
 * @property {number} app        - Next.js port
 * @property {number} postgresql - PostgreSQL port
 * @property {number} mongodb    - MongoDB port
 */

// ─── .env I/O ───

/**
 * Parse a .env file into a key-value object.
 * Supports: KEY=VALUE, KEY="VALUE", comments (#), empty lines.
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
function parseEnv(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    // Unquote "..."
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }
  return result;
}

/**
 * Write a key-value object to a .env file.
 * Values with spaces or # get quoted.
 * @param {string} filePath
 * @param {Record<string, string>} vars
 */
function writeEnv(filePath, vars) {
  const lines = [];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined || value === null) continue;
    const needsQuotes = /[\s#]/.test(value) || value === "";
    lines.push(needsQuotes ? `${key}="${value}"` : `${key}=${value}`);
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

/**
 * Merge new variables into an existing .env file,
 * preserving comments and order where possible.
 * @param {string} filePath
 * @param {Record<string, string>} updates
 */
function mergeEnv(filePath, updates) {
  const existing = parseEnv(filePath);
  const merged = { ...existing, ...updates };

  // Preserve existing file structure if possible
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    const seen = new Set();
    const out = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        out.push(line);
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq === -1) {
        out.push(line);
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      if (updates[key] !== undefined) {
        const needsQuotes = /[\s#]/.test(updates[key]) || updates[key] === "";
        out.push(needsQuotes ? `${key}="${updates[key]}"` : `${key}=${updates[key]}`);
        seen.add(key);
      } else {
        out.push(line);
        seen.add(key);
      }
    }

    // Append any new keys
    for (const [key, value] of Object.entries(updates)) {
      if (!seen.has(key)) {
        const needsQuotes = /[\s#]/.test(value) || value === "";
        out.push(needsQuotes ? `${key}="${value}"` : `${key}=${value}`);
      }
    }

    fs.writeFileSync(filePath, out.join("\n") + "\n", "utf8");
    return;
  }

  // No existing file — write fresh
  writeEnv(filePath, merged);
}

// ─── Port Detection ───

/**
 * Check if a TCP port is available on a given host.
 * @param {number} port
 * @param {string} [host='127.0.0.1']
 * @returns {Promise<boolean>}
 */
function isPortAvailable(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

/**
 * Find the next available port starting from `startPort`.
 * @param {number} startPort
 * @param {number} [maxAttempts=20]
 * @returns {Promise<number>}
 */
async function findAvailablePort(startPort, maxAttempts = 20) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(
    `No available port found in range ${startPort}-${startPort + maxAttempts}`
  );
}

/**
 * Find available ports for all services.
 * @returns {Promise<PortConfig>}
 */
async function findAllPorts() {
  const [app, postgresql, mongodb] = await Promise.all([
    findAvailablePort(3000, 20),
    findAvailablePort(5432, 20),
    findAvailablePort(27017, 20),
  ]);
  return { app, postgresql, mongodb };
}

// ─── System Detection ───

/**
 * Check if a shell command exists.
 * @param {string} cmd
 * @returns {boolean}
 */
function checkCommand(cmd) {
  try {
    const shellCmd =
      process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
    execSync(shellCmd, { stdio: "pipe", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Docker & Docker Compose are available.
 * @returns {boolean}
 */
function checkDocker() {
  try {
    execSync("docker --version", { stdio: "pipe", timeout: 3000 });
    execSync("docker compose version", { stdio: "pipe", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Database Provider Detection ───

/**
 * Detect database provider from a connection URL.
 * @param {string} databaseUrl
 * @returns {DbConfig['provider'] | null}
 */
function detectProvider(databaseUrl) {
  if (!databaseUrl) return null;
  const url = databaseUrl.toLowerCase();

  if (url.startsWith("file:") || url.endsWith(".db") || url.endsWith(".sqlite")) {
    return "sqlite";
  }
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    return "postgresql";
  }
  if (url.startsWith("mysql://") || url.startsWith("mariadb://")) {
    return "postgresql"; // map mysql → postgresql for Prisma
  }
  if (url.startsWith("mongodb://") || url.startsWith("mongodb+srv://")) {
    return "mongodb";
  }
  return null;
}

/**
 * Get a connection URL template for a provider.
 * @param {DbConfig['provider']} provider
 * @param {number} [port]
 * @returns {string}
 */
function getUrlTemplate(provider, port) {
  const p = port;
  switch (provider) {
    case "sqlite":
      return "file:./prisma/data.db";
    case "postgresql":
      return `postgresql://postgres:password@localhost:${p || 5432}/maestria_lms?schema=public`;
    case "mongodb":
      return `mongodb://localhost:${p || 27017}/maestria_lms`;
    default:
      return "file:./prisma/data.db";
  }
}

/**
 * Validate a database URL against its provider.
 * @param {string} url
 * @param {DbConfig['provider']} provider
 * @returns {boolean}
 */
function validateDatabaseUrl(url, provider) {
  if (!url) return false;
  const lower = url.toLowerCase();
  switch (provider) {
    case "sqlite":
      return lower.startsWith("file:") || lower.endsWith(".db");
    case "postgresql":
      return lower.startsWith("postgresql://") || lower.startsWith("postgres://");
    case "mongodb":
      return lower.startsWith("mongodb://") || lower.startsWith("mongodb+srv://");
    default:
      return false;
  }
}

// ─── Optimal Config Detection ───

/**
 * Detect the optimal database configuration for the current environment.
 * Priority: Docker PostgreSQL → local PostgreSQL → local MongoDB → SQLite.
 * @param {PortConfig} [ports]
 * @returns {DbConfig}
 */
function detectOptimalConfig(ports) {
  const isWindows = os.platform() === "win32";
  const hasDocker = checkDocker();
  const hasPostgres = checkCommand("pg_isready") || checkCommand("psql");
  const hasMongo = checkCommand("mongosh") || checkCommand("mongo");

  // 1. Docker available → PostgreSQL (production parity)
  if (hasDocker) {
    return {
      provider: "postgresql",
      url: getUrlTemplate("postgresql", ports?.postgresql),
      port: ports?.postgresql || 5432,
      reason: "Docker available — PostgreSQL recommended for production parity",
      docker: true,
    };
  }

  // 2. Local PostgreSQL
  if (hasPostgres) {
    return {
      provider: "postgresql",
      url: getUrlTemplate("postgresql", ports?.postgresql),
      port: ports?.postgresql || 5432,
      reason: "PostgreSQL detected locally",
    };
  }

  // 3. Local MongoDB
  if (hasMongo) {
    return {
      provider: "mongodb",
      url: getUrlTemplate("mongodb", ports?.mongodb),
      port: ports?.mongodb || 27017,
      reason: "MongoDB detected locally",
    };
  }

  // 4. Windows without Docker → SQLite
  if (isWindows) {
    return {
      provider: "sqlite",
      url: getUrlTemplate("sqlite"),
      reason: "Windows without Docker — SQLite is simplest",
    };
  }

  // 5. Default fallback → SQLite
  return {
    provider: "sqlite",
    url: getUrlTemplate("sqlite"),
    reason: "No database server detected — SQLite (zero-config)",
  };
}

// ─── Package Manager Detection ───

/**
 * Detect the package manager used in the project.
 * @param {string} root — project root path
 * @returns {{ name: string, cmd: string }}
 */
function detectPackageManager(root) {
  const managers = ["bun", "pnpm", "yarn", "npm"];
  const lockFiles = {
    bun: "bun.lock",
    pnpm: "pnpm-lock.yaml",
    yarn: "yarn.lock",
    npm: "package-lock.json",
  };

  let lockHint = null;
  for (const [name, file] of Object.entries(lockFiles)) {
    if (fs.existsSync(path.join(root, file))) {
      lockHint = name;
      break;
    }
  }

  const available = [];
  for (const cmd of managers) {
    try {
      const shellCmd =
        process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
      execSync(shellCmd, { stdio: ["ignore", "pipe", "ignore"] });
      available.push(cmd);
    } catch {}
  }

  if (available.length === 0) {
    return { name: "npm", cmd: "npm" };
  }

  const chosen =
    lockHint && available.includes(lockHint) ? lockHint : available[0];
  return { name: chosen, cmd: chosen };
}

// ─── Exports ───

module.exports = {
  // .env
  parseEnv,
  writeEnv,
  mergeEnv,

  // Ports
  isPortAvailable,
  findAvailablePort,
  findAllPorts,

  // System
  checkCommand,
  checkDocker,
  detectPackageManager,

  // Database
  detectProvider,
  getUrlTemplate,
  validateDatabaseUrl,
  detectOptimalConfig,
};
