/**
 * Automated Database Backup Script
 *
 * Creates timestamped database backups with optional compression.
 * Supports SQLite (file copy) and PostgreSQL (pg_dump) databases.
 *
 * Usage:
 *   node scripts/backup-db.js              # Default backup
 *   node scripts/backup-db.js --compress   # With gzip compression
 *   node scripts/backup-db.js --retain 7   # Keep only last 7 backups
 *   node scripts/backup-db.js --output ./custom-backup-dir
 *
 * Can be scheduled via cron:
 *   0 3 * * * cd /app && node scripts/backup-db.js --compress --retain 7
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ─── Configuration ───────────────────────────────────────────────────────────

const DEFAULT_BACKUP_DIR = path.resolve(__dirname, "..", "backups");
const TIMESTAMP_FORMAT = "YYYY-MM-DD_HHmmss";
const DEFAULT_RETENTION_DAYS = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function getEnvVar(name) {
  // Try reading from .env file if not in process.env
  if (process.env[name]) return process.env[name];

  try {
    const envPath = path.resolve(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const match = envContent.match(new RegExp(`^${name}=["']?(.*?)["']?$`, "m"));
      if (match) return match[1].trim();
    }
  } catch {
    // Ignore .env read errors
  }

  return null;
}

// ─── Backup Strategies ───────────────────────────────────────────────────────

function backupSqlite(backupPath) {
  const dbUrl = getEnvVar("DATABASE_URL");
  if (!dbUrl) {
    throw new Error("DATABASE_URL not found in environment or .env file");
  }

  // Extract file path from SQLite URL (e.g., "file:./prisma/dev.db" or just a path)
  let dbPath = dbUrl.replace(/^file:/, "");
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.resolve(__dirname, "..", dbPath);
  }

  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite database file not found at: ${dbPath}`);
  }

  const stats = fs.statSync(dbPath);
  console.log(`  Source: ${dbPath} (${formatBytes(stats.size)})`);

  // Use WAL checkpoint first for consistency
  try {
    const betterSqlite = require("better-sqlite3");
    const db = betterSqlite(dbPath);
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
    console.log("  WAL checkpoint completed");
  } catch {
    // better-sqlite3 may not be installed; skip checkpoint
    console.log("  (WAL checkpoint skipped — better-sqlite3 not available)");
  }

  // Copy the database file
  fs.copyFileSync(dbPath, backupPath);
  console.log(`  Copied to: ${backupPath}`);
}

function backupPostgres(backupPath) {
  const dbUrl = getEnvVar("DATABASE_URL");
  if (!dbUrl) {
    throw new Error("DATABASE_URL not found in environment or .env file");
  }

  console.log("  Using pg_dump for PostgreSQL backup...");

  try {
    execSync(
      `pg_dump "${dbUrl}" --format=custom --no-owner --no-acl --file="${backupPath}"`,
      { stdio: "pipe", timeout: 120_000 },
    );
    console.log(`  Dumped to: ${backupPath}`);
  } catch (error) {
    throw new Error(
      `pg_dump failed. Ensure PostgreSQL client tools are installed.\n` +
        `  ${error.stderr?.toString() || error.message}`,
    );
  }
}

// ─── Compression ─────────────────────────────────────────────────────────────

function compressFile(filePath) {
  return new Promise((resolve, reject) => {
    const compressedPath = `${filePath}.gz`;
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(compressedPath);
    const gzip = zlib.createGzip({ level: 6 });

    readStream
      .pipe(gzip)
      .pipe(writeStream)
      .on("finish", () => {
        // Remove uncompressed file
        fs.unlinkSync(filePath);
        console.log(`  Compressed to: ${compressedPath}`);
        resolve(compressedPath);
      })
      .on("error", reject);
  });
}

// ─── Retention ───────────────────────────────────────────────────────────────

function cleanOldBackups(backupDir, retainCount) {
  if (retainCount <= 0) return;

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("maestria-backup-"))
    .map((f) => ({
      name: f,
      path: path.join(backupDir, f),
      mtime: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  if (files.length <= retainCount) {
    console.log(`  Retention: ${files.length} backups (≤ ${retainCount}), nothing to clean`);
    return;
  }

  const toDelete = files.slice(retainCount);
  let deletedSize = 0;

  for (const file of toDelete) {
    const stats = fs.statSync(file.path);
    deletedSize += stats.size;
    fs.unlinkSync(file.path);
    console.log(`  Removed old backup: ${file.name}`);
  }

  console.log(
    `  Retention: removed ${toDelete.length} old backup(s) (${formatBytes(deletedSize)})`,
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const shouldCompress = args.includes("--compress");
  const retainIndex = args.indexOf("--retain");
  const retainCount =
    retainIndex >= 0 ? parseInt(args[retainIndex + 1], 10) || DEFAULT_RETENTION_DAYS : 0;
  const outputIndex = args.indexOf("--output");
  const backupDir = outputIndex >= 0 ? path.resolve(args[outputIndex + 1]) : DEFAULT_BACKUP_DIR;

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Created backup directory: ${backupDir}`);
  }

  // Detect database type
  const dbUrl = getEnvVar("DATABASE_URL") || "";
  const isPostgres =
    dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://");
  const isSqlite = !isPostgres;

  const timestamp = getTimestamp();
  const extension = isPostgres ? "dump" : "db";
  const backupName = `maestria-backup-${timestamp}.${extension}`;
  const backupPath = path.join(backupDir, backupName);

  console.log(`\n=== Maestria LMS Database Backup ===`);
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  Database:  ${isPostgres ? "PostgreSQL" : "SQLite"}`);
  console.log(`  Output:    ${backupPath}`);
  console.log(`  Compress:  ${shouldCompress ? "yes" : "no"}`);
  console.log("");

  // Perform backup
  const startTime = Date.now();

  try {
    if (isPostgres) {
      backupPostgres(backupPath);
    } else {
      backupSqlite(backupPath);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const stats = fs.statSync(backupPath);
    console.log(`  Size: ${formatBytes(stats.size)}`);
    console.log(`  Duration: ${elapsed}s`);

    // Compress if requested
    let finalPath = backupPath;
    if (shouldCompress) {
      finalPath = await compressFile(backupPath);
      const compressedStats = fs.statSync(finalPath);
      console.log(`  Compressed size: ${formatBytes(compressedStats.size)}`);
    }

    // Clean old backups
    if (retainCount > 0) {
      cleanOldBackups(backupDir, retainCount);
    }

    console.log(`\n✓ Backup completed successfully: ${finalPath}\n`);
    process.exit(0);
  } catch (error) {
    console.error(`\n✗ Backup failed: ${error.message}\n`);
    process.exit(1);
  }
}

main();