#!/usr/bin/env node

/**
 * Maestria LMS — Advanced Setup & Dev Launcher v2.0
 * Features:
 * - Multi-database support (SQLite, PostgreSQL, MongoDB)
 * - Auto-detect optimal database configuration
 * - Auto-find available ports for app and databases
 * - Cross-platform package manager detection
 * - Docker Compose integration for PostgreSQL/MongoDB
 */

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const crypto = require("crypto");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const ENV_LOCAL_FILE = path.join(ROOT, ".env.local");
const ENV_EXAMPLE_FILE = path.join(ROOT, ".env.example");
const DOCKER_COMPOSE_FILE = path.join(ROOT, "docker-compose.db.yml");

// ─── Colors ───
const useColor = process.platform !== "win32" || !!process.env.WT_SESSION || !!process.env.TERM;
const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};
const color = (str, c) => (useColor ? `${c}${str}${C.reset}` : str);
const ok = (s) => color(`✓ ${s}`, C.green);
const info = (s) => color(`› ${s}`, C.cyan);
const warn = (s) => color(`! ${s}`, C.yellow);
const err = (s) => color(`✗ ${s}`, C.red);
const head = (s) => color(s, C.bold);
const dbColor = (s, provider) => {
  const colors = { sqlite: C.cyan, postgresql: C.blue, mongodb: C.green };
  return color(s, colors[provider] || C.cyan);
};

// ─── Package Manager Detection ───
function detectPackageManager() {
  const managers = ["bun", "pnpm", "yarn", "npm"];
  const lockFiles = {
    bun: "bun.lock",
    pnpm: "pnpm-lock.yaml",
    yarn: "yarn.lock",
    npm: "package-lock.json",
  };

  let lockHint = null;
  for (const [name, file] of Object.entries(lockFiles)) {
    if (fs.existsSync(path.join(ROOT, file))) {
      lockHint = name;
      break;
    }
  }

  const available = [];
  for (const cmd of managers) {
    try {
      const command = process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
      execSync(command, { stdio: ["ignore", "pipe", "ignore"] });
      available.push(cmd);
    } catch {}
  }

  if (available.length === 0) {
    console.log(warn("No package manager found. Defaulting to npm."));
    return { name: "npm", cmd: "npm" };
  }

  const chosen = lockHint && available.includes(lockHint) ? lockHint : available[0];
  console.log(info(`Package manager: ${chosen}`));
  return { name: chosen, cmd: chosen };
}

// ─── Port Detection ───
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

async function findAvailablePort(startPort, maxAttempts = 20) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const available = await isPortAvailable(port);
    if (available) return port;
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts}`);
}

async function findAllPorts() {
  console.log(info("Scanning for available ports..."));
  const [app, pg, mongo] = await Promise.all([
    findAvailablePort(3000),
    findAvailablePort(5432),
    findAvailablePort(27017),
  ]);
  return { app, postgresql: pg, mongodb: mongo };
}

// ─── Environment Parsing ───
function parseEnv(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    result[key] = value;
  }
  return result;
}

function writeEnv(envPath, vars) {
  const lines = [];
  for (const [key, value] of Object.entries(vars)) {
    if (/[# ]/.test(value)) {
      lines.push(`${key}="${value}"`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf8");
}

// ─── Database Detection ───
function checkCommand(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: "pipe", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function checkDocker() {
  try {
    execSync("docker --version", { stdio: "pipe", timeout: 3000 });
    execSync("docker compose version", { stdio: "pipe", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function detectOptimalDb(ports) {
  const isWindows = os.platform() === "win32";
  const hasDocker = checkDocker();
  const hasPostgres = checkCommand("pg_isready") || checkCommand("psql");
  const hasMongo = checkCommand("mongosh") || checkCommand("mongo");

  // Priority 1: Docker → PostgreSQL
  if (hasDocker) {
    return {
      provider: "postgresql",
      url: `postgresql://postgres:password@localhost:${ports.postgresql}/maestria_lms?schema=public`,
      port: ports.postgresql,
      reason: "Docker available — PostgreSQL recommended for production parity",
      docker: true,
    };
  }

  // Priority 2: Local PostgreSQL
  if (hasPostgres) {
    return {
      provider: "postgresql",
      url: `postgresql://postgres:password@localhost:${ports.postgresql}/maestria_lms?schema=public`,
      port: ports.postgresql,
      reason: "PostgreSQL detected locally",
    };
  }

  // Priority 3: Local MongoDB
  if (hasMongo) {
    return {
      provider: "mongodb",
      url: `mongodb://localhost:${ports.mongodb}/maestria_lms`,
      port: ports.mongodb,
      reason: "MongoDB detected locally",
    };
  }

  // Priority 4: Windows → SQLite
  if (isWindows) {
    return {
      provider: "sqlite",
      url: "file:./prisma/data.db",
      reason: "Windows without Docker — SQLite is simplest",
    };
  }

  // Default: SQLite
  return {
    provider: "sqlite",
    url: "file:./prisma/data.db",
    reason: "No database server detected — SQLite (zero-config)",
  };
}

function detectProviderFromUrl(url) {
  if (!url) return "sqlite";
  const lower = url.toLowerCase();
  if (lower.startsWith("file:") || lower.endsWith(".db")) return "sqlite";
  if (lower.startsWith("postgresql://") || lower.startsWith("postgres://")) return "postgresql";
  if (lower.startsWith("mongodb://") || lower.startsWith("mongodb+srv://")) return "mongodb";
  return "sqlite";
}

// ─── Docker Compose ───
function generateDockerCompose(pgPort, mongoPort) {
  return `version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    container_name: maestria-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: maestria_lms
    ports:
      - "${pgPort}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  mongodb:
    image: mongo:7-jammy
    container_name: maestria-mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
      MONGO_INITDB_DATABASE: maestria_lms
    ports:
      - "${mongoPort}:27017"
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  mongodb_data:
`;
}

function ensureDockerCompose(ports) {
  if (!fs.existsSync(DOCKER_COMPOSE_FILE)) {
    console.log(info("Creating docker-compose.db.yml..."));
    fs.writeFileSync(DOCKER_COMPOSE_FILE, generateDockerCompose(ports.postgresql, ports.mongodb));
    console.log(ok("docker-compose.db.yml created"));
  }
}

// ─── .env Generation ───
function generateEnvExample(appPort, dbPorts) {
  return `# ═══════════════════════════════════════════════════
# Maestria LMS — Environment Configuration
# Auto-generated by setup-v2.js
# ═══════════════════════════════════════════════════

# ─── Database ───
# Supported: sqlite, postgresql, mongodb
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./prisma/data.db

# ─── NextAuth ───
NEXTAUTH_URL=http://localhost:${appPort}
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
NEXTAUTH_SECRET=

# ─── CDN & Assets ───
NEXT_PUBLIC_CDN_URL=https://ui3adtb308.a.trbcdn.net
NEXT_PUBLIC_SITE_URL=https://maestria.edu

# ─── S3 Storage (optional) ───
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=https://s3c3.001.gpucloud.ru
S3_BUCKET_NAME=maestria-lms
S3_REGION=auto

# ─── Development ───
ALLOW_SEED_DATA=true
`;
}

async function validateAndGenerateEnv(ports, forcedProvider = null) {
  const envVars = parseEnv(ENV_FILE);
  const envLocalVars = parseEnv(ENV_LOCAL_FILE);
  const allVars = { ...envVars, ...envLocalVars };

  let changed = false;
  let dbConfig;

  // Determine database provider
  if (forcedProvider) {
    const templates = {
      sqlite: "file:./prisma/data.db",
      postgresql: `postgresql://postgres:password@localhost:${ports.postgresql}/maestria_lms?schema=public`,
      mongodb: `mongodb://localhost:${ports.mongodb}/maestria_lms`,
    };
    dbConfig = {
      provider: forcedProvider,
      url: templates[forcedProvider],
      reason: `Manually selected: ${forcedProvider}`,
    };
  } else if (envVars.DATABASE_PROVIDER && envVars.DATABASE_URL) {
    // Use existing config
    dbConfig = {
      provider: envVars.DATABASE_PROVIDER,
      url: envVars.DATABASE_URL,
      reason: "Using existing configuration",
    };
  } else {
    // Auto-detect
    dbConfig = detectOptimalDb(ports);
  }

  // Update DATABASE_PROVIDER
  if (envVars.DATABASE_PROVIDER !== dbConfig.provider) {
    envVars.DATABASE_PROVIDER = dbConfig.provider;
    changed = true;
    console.log(info(`Database provider: ${dbColor(dbConfig.provider, dbConfig.provider)}`));
    console.log(info(`Reason: ${dbConfig.reason}`));
  }

  // Update DATABASE_URL
  if (envVars.DATABASE_URL !== dbConfig.url) {
    envVars.DATABASE_URL = dbConfig.url;
    changed = true;
    console.log(info(`Database URL: ${dbConfig.url}`));
  }

  // Ensure NEXTAUTH_SECRET
  if (!allVars.NEXTAUTH_SECRET) {
    const secret = crypto.randomBytes(32).toString("base64");
    const localContent = fs.existsSync(ENV_LOCAL_FILE)
      ? fs.readFileSync(ENV_LOCAL_FILE, "utf8").trimEnd() + "\n"
      : "";
    fs.writeFileSync(ENV_LOCAL_FILE, localContent + `NEXTAUTH_SECRET=${secret}\n`, "utf8");
    changed = true;
    console.log(ok("Generated NEXTAUTH_SECRET in .env.local"));
  }

  // Update NEXTAUTH_URL
  const expectedUrl = `http://localhost:${ports.app}`;
  if (allVars.NEXTAUTH_URL !== expectedUrl) {
    envVars.NEXTAUTH_URL = expectedUrl;
    changed = true;
    console.log(info(`App URL: ${expectedUrl}`));
  }

  // Write .env
  if (changed) {
    writeEnv(ENV_FILE, envVars);
    console.log(ok("Configuration saved to .env"));
  }

  // Generate .env.example
  fs.writeFileSync(ENV_EXAMPLE_FILE, generateEnvExample(ports.app, ports), "utf8");

  return dbConfig;
}

// ─── Docker Management ───
function startDockerServices(provider) {
  if (provider !== "postgresql" && provider !== "mongodb") return;

  console.log(info("Checking Docker services..."));
  try {
    const status = execSync("docker compose -f docker-compose.db.yml ps --format json", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (status.includes("running")) {
      console.log(ok("Docker services already running"));
      return;
    }
  } catch {}

  console.log(info("Starting Docker services..."));
  try {
    execSync("docker compose -f docker-compose.db.yml up -d", {
      cwd: ROOT,
      stdio: "inherit",
    });
    console.log(ok("Docker services started"));

    // Wait for healthcheck
    console.log(info("Waiting for database to be ready..."));
    const service = provider === "postgresql" ? "postgres" : "mongodb";
    execSync(`docker compose -f docker-compose.db.yml exec ${service} sh -c "until pg_isready || mongosh --eval 'db.adminCommand(\"ping\")' ; do sleep 1; done"`, {
      cwd: ROOT,
      stdio: "pipe",
      timeout: 30000,
    });
    console.log(ok("Database is ready"));
  } catch (error) {
    console.log(warn("Docker services failed to start. Ensure Docker is running."));
    console.log(info("You can start them manually:"));
    console.log(info("  docker compose -f docker-compose.db.yml up -d"));
  }
}

// ─── Prerequisites ───
function runCommand(cmd, label, cwd = ROOT) {
  console.log(info(label || `Running: ${cmd}`));
  try {
    const start = Date.now();
    execSync(cmd, { cwd, stdio: "inherit", shell: true });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(ok(`${label || cmd} (${elapsed}s)`));
  } catch {
    console.log(err(`${label || cmd} failed`));
    process.exit(1);
  }
}

function runPrerequisites(pm, provider) {
  runCommand(`${pm.cmd} install`, "Installing dependencies");

  if (provider === "mongodb") {
    console.log(info("MongoDB detected — skipping Prisma"));
    return;
  }

  runCommand(`${pm.cmd} run db:generate`, "Generating Prisma client");
  runCommand(`${pm.cmd} run db:push`, "Pushing schema to database");
}

// ─── Dev Server ───
function startDevServer(pm, port) {
  const tryStart = (startPort, attempts = 0) => {
    if (attempts > 10) {
      console.log(err("Failed to find available port after 10 attempts"));
      process.exit(1);
    }

    console.log("");
    console.log(head(`  🚀 Maestria LMS starting at ${color(`http://localhost:${startPort}`, C.green)}`));
    console.log("");

    const child = spawn(pm.cmd, ["next", "dev", "--port", String(startPort)], {
      cwd: ROOT,
      stdio: ["inherit", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    let hasError = false;

    child.stderr.on("data", (data) => {
      const msg = data.toString();
      process.stderr.write(data);
      if (msg.includes("EADDRINUSE")) {
        hasError = true;
        console.log(warn(`Port ${startPort} is in use, trying next...`));
        tryStart(startPort + 1, attempts + 1);
      }
    });

    child.stdout.on("data", (data) => {
      process.stdout.write(data);
    });

    child.on("error", (e) => {
      if (e.message.includes("EADDRINUSE") && !hasError) {
        console.log(warn(`Port ${startPort} is in use, trying next...`));
        tryStart(startPort + 1, attempts + 1);
      } else if (!hasError) {
        console.log(err(`Failed to start: ${e.message}`));
        process.exit(1);
      }
    });

    child.on("close", (code) => {
      if (!hasError) process.exit(code || 0);
    });

    process.on("SIGINT", () => child.kill("SIGINT"));
    process.on("SIGTERM", () => child.kill("SIGTERM"));
  };

  tryStart(port);
}

// ─── Main ───
async function main() {
  console.log(head("\n  🎓 Maestria LMS — Smart Setup v2.0\n"));

  const pm = detectPackageManager();
  const ports = await findAllPorts();

  console.log(ok(`App port: ${ports.app}`));
  console.log(info(`DB ports — PostgreSQL: ${ports.postgresql}, MongoDB: ${ports.mongodb}`));

  // Check for forced provider
  const forcedProvider = process.argv.includes("--db")
    ? process.argv[process.argv.indexOf("--db") + 1]
    : null;

  if (forcedProvider) {
    console.log(info(`Forced database: ${forcedProvider}`));
  }

  const dbConfig = await validateAndGenerateEnv(ports, forcedProvider);

  // Docker setup for PostgreSQL/MongoDB
  if (dbConfig.docker || (dbConfig.provider === "postgresql" && checkDocker())) {
    ensureDockerCompose(ports);
    startDockerServices(dbConfig.provider);
  }

  runPrerequisites(pm, dbConfig.provider);
  startDevServer(pm, ports.app);
}

main().catch((e) => {
  console.log(err(`Fatal: ${e.message}`));
  process.exit(1);
});
