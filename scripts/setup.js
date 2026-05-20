#!/usr/bin/env node

/**
 * Cross-platform setup and dev server launcher.
 * Auto-detects package manager, finds an available port,
 * validates/generates .env, runs prerequisites, and starts the dev server.
 */

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const ENV_LOCAL_FILE = path.join(ROOT, ".env.local");
const ENV_EXAMPLE_FILE = path.join(ROOT, ".env.example");

// --- Color output (disabled on Windows if not in a modern terminal) ---
const useColor =
  process.platform !== "win32" || !!process.env.WT_SESSION || !!process.env.TERM;
const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
};
function color(str, c) {
  return useColor ? `${c}${str}${C.reset}` : str;
}
const ok = (s) => color(`✓ ${s}`, C.green);
const info = (s) => color(`› ${s}`, C.cyan);
const warn = (s) => color(`! ${s}`, C.yellow);
const err = (s) => color(`✗ ${s}`, C.red);
const head = (s) => color(s, C.bold);

// --- Phase 1: Package Manager Detection ---
function detectPackageManager() {
  const managers = ["bun", "pnpm", "yarn", "npm"];
  const lockFiles = {
    bun: "bun.lock",
    pnpm: "pnpm-lock.yaml",
    yarn: "yarn.lock",
    npm: "package-lock.json",
  };

  // Check lock files first for a hint
  let lockHint = null;
  for (const [name, file] of Object.entries(lockFiles)) {
    if (fs.existsSync(path.join(ROOT, file))) {
      lockHint = name;
      break;
    }
  }

  // Check which executables are available
  const available = [];
  for (const cmd of managers) {
    try {
      const command = process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
      execSync(command, { stdio: ["ignore", "pipe", "ignore"] });
      available.push(cmd);
    } catch {
      // not found
    }
  }

  if (available.length === 0) {
    console.log(warn("No package manager found. Defaulting to npm."));
    return { name: "npm", cmd: "npm" };
  }

  // Prefer lock file hint if available, otherwise first in priority order
  const chosen =
    lockHint && available.includes(lockHint)
      ? lockHint
      : available[0];

  console.log(info(`Package manager: ${chosen}`));
  return { name: chosen, cmd: chosen };
}

// --- Phase 2: Port Detection ---
function findAvailablePort(startPort = 3000, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > startPort + maxAttempts) {
        reject(new Error(`No available port found in range ${startPort}-${startPort + maxAttempts}`));
        return;
      }
      // Check both IPv4 and IPv6 since Next.js binds to all interfaces
      const checkInterface = (host, callback) => {
        const server = net.createServer();
        server.listen(port, host, () => {
          server.close(() => callback(null));
        });
        server.on("error", () => callback(new Error("in use")));
      };

      checkInterface("127.0.0.1", (ipv4Err) => {
        if (ipv4Err) {
          tryPort(port + 1);
          return;
        }
        checkInterface("::1", (ipv6Err) => {
          if (ipv6Err) {
            tryPort(port + 1);
            return;
          }
          resolve(port);
        });
      });
    };
    tryPort(startPort);
  });
}

// --- Phase 3: .env Validation & Generation ---
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
    // Quote values that contain spaces or special chars
    if (/[# ]/.test(value)) {
      lines.push(`${key}="${value}"`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf8");
}

function generateEnvExample(port) {
  return `# Database (SQLite)
DATABASE_URL=file:./data.db

# NextAuth
NEXTAUTH_URL=http://localhost:${port}
NEXTAUTH_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">

# CDN (optional)
NEXT_PUBLIC_CDN_URL=https://ui3adtb308.a.trbcdn.net
NEXT_PUBLIC_SITE_URL=https://maestria.edu

# S3 Storage (optional - leave empty if not using S3)
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT=
S3_BUCKET=maestria-lms
S3_REGION=auto

# Seed data (set to true to allow /api/seed endpoint in development)
ALLOW_SEED_DATA=true
`;
}

async function validateAndGenerateEnv(port) {
  const envVars = parseEnv(ENV_FILE);
  const envLocalVars = parseEnv(ENV_LOCAL_FILE);
  const allVars = { ...envVars, ...envLocalVars };

  let changed = false;

  // Ensure DATABASE_URL
  if (!envVars.DATABASE_URL) {
    envVars.DATABASE_URL = "file:./data.db";
    changed = true;
    console.log(info(`Set DATABASE_URL=file:./data.db`));
  }

  // Ensure NEXTAUTH_SECRET (prefer .env.local)
  if (!allVars.NEXTAUTH_SECRET) {
    const secret = crypto.randomBytes(32).toString("base64");
    // Write to .env.local for security
    const localContent = fs.existsSync(ENV_LOCAL_FILE)
      ? fs.readFileSync(ENV_LOCAL_FILE, "utf8").trimEnd() + "\n"
      : "";
    fs.writeFileSync(ENV_LOCAL_FILE, localContent + `NEXTAUTH_SECRET=${secret}\n`, "utf8");
    changed = true;
    console.log(info("Generated NEXTAUTH_SECRET in .env.local"));
  }

  // Update NEXTAUTH_URL to match detected port
  const expectedUrl = `http://localhost:${port}`;
  if (allVars.NEXTAUTH_URL !== expectedUrl) {
    envVars.NEXTAUTH_URL = expectedUrl;
    changed = true;
    console.log(info(`Set NEXTAUTH_URL=${expectedUrl}`));
  }

  // Write updated .env if changed
  if (changed) {
    writeEnv(ENV_FILE, envVars);
    console.log(ok(".env updated"));
  }

  // Generate .env.example (always, to keep it in sync)
  fs.writeFileSync(ENV_EXAMPLE_FILE, generateEnvExample(port), "utf8");
  console.log(ok(".env.example generated"));
}

// --- Phase 4: Prerequisites ---
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

function runPrerequisites(pm) {
  const cmd = pm.cmd;
  runCommand(`${cmd} install`, "Installing dependencies");
  runCommand(`${cmd} run db:generate`, "Generating Prisma client");
  runCommand(`${cmd} run db:push`, "Pushing Prisma schema");
}

// --- Phase 5: Start Dev Server ---
function startDevServer(pm, port) {
  console.log("");
  console.log(head(`  Dev server starting at ${color(`http://localhost:${port}`, C.green)}`));
  console.log("");

  const child = spawn(pm.cmd, ["next", "dev", "--port", String(port)], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("error", (e) => {
    console.log(err(`Failed to start dev server: ${e.message}`));
    process.exit(1);
  });

  child.on("close", (code) => {
    process.exit(code || 0);
  });

  // Forward signals to child
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

// --- Main ---
async function main() {
  console.log(head("\n  Maestria LMS — Setup & Dev\n"));

  const pm = detectPackageManager();
  const port = await findAvailablePort(3000);

  if (port !== 3000) {
    console.log(warn(`Port 3000 is in use, using port ${port} instead`));
  }

  await validateAndGenerateEnv(port);
  runPrerequisites(pm);
  startDevServer(pm, port);
}

main().catch((e) => {
  console.log(err(`Fatal: ${e.message}`));
  process.exit(1);
});
