// Seed entrypoint that works with the TS-only Prisma 7 generated client.
// Prisma's default seed command (`node prisma/seed.mjs`) cannot import the
// generated TypeScript client, so we load it through jiti (already a runtime
// dependency of the Prisma CLI).
//
// .env is loaded here because neither this file nor prisma/seed.mjs did it:
// locally DATABASE_URL was therefore unset and both the emptiness check and the
// seed itself silently fell back to the SQLite file, seeding the wrong database
// while the remote one stayed empty. dotenv never overrides variables that are
// already set, so the Amvera runtime (no .env file) is unaffected.
require("dotenv/config");

const { createJiti } = require("jiti");
const fs = require("fs");
const path = require("path");
const { describeDatabaseError } = require("./lib/db-error");

const ifEmpty = process.argv.includes("--if-empty");
const force = process.argv.includes("--force");

/**
 * Decide whether seeding should run at all.
 *
 * Database guard: with --if-empty the seed runs only when the database has no
 * courses, so fresh deploys get demo content but production data is untouched.
 *
 * Returns a promise on purpose. The previous version fired this check as a
 * detached async IIFE and started the seed immediately afterwards, so the two
 * raced: on an already-populated database the seed could begin deleting rows
 * before the guard decided to skip it.
 */
async function shouldSeed() {
  if (!ifEmpty) return true;

  try {
    const url = process.env.DATABASE_URL || "file:./prisma/data.db";
    const isSQLite =
      !url.startsWith("postgresql") &&
      !url.startsWith("postgres") &&
      !url.startsWith("mysql") &&
      !url.startsWith("mongodb");

    if (!isSQLite) {
      // For PostgreSQL / MySQL / MongoDB: use Prisma to check the Course count.
      // The client is loaded through jiti because the Prisma 7 generator emits
      // TypeScript only (src/generated/prisma/client.ts). A plain
      // import("../src/generated/prisma/client.js") threw MODULE_NOT_FOUND,
      // which this function treats as "unknown, seed anyway" — so every deploy
      // re-ran the seed and wiped the production data it was meant to protect.
      const jiti = await createJiti(__filename);
      const { PrismaClient } = await jiti.import("../src/generated/prisma/client.ts");

      let adapter;
      const lower = url.toLowerCase();
      if (lower.startsWith("postgresql") || lower.startsWith("postgres")) {
        const { PrismaPg } = await import("@prisma/adapter-pg");
        adapter = new PrismaPg({
          connectionString: url,
          ...(process.env.DATABASE_SSL === "true" ? { ssl: { rejectUnauthorized: false } } : {}),
        });
      } else if (lower.startsWith("mysql") || lower.startsWith("mariadb")) {
        console.log("[seed] MySQL/MariaDB: cannot safely check emptiness — skipping seed unless --force");
        return force;
      } else if (lower.startsWith("mongodb")) {
        console.log("[seed] MongoDB: cannot safely check emptiness — skipping seed unless --force");
        return force;
      } else {
        console.log("[seed] Unknown database provider — skipping seed unless --force");
        return force;
      }

      const db = new PrismaClient({ adapter });
      try {
        // count() instead of aggregate({ _count: true }): the latter returns
        // { _count: { _all: n } }, so destructuring `count` yielded undefined
        // and every database looked empty — the guard never fired.
        const count = await db.course.count();
        if (count > 0) {
          console.log(`[seed] database already has ${count} course(s) — skipping seed`);
          return false;
        }
        console.log("[seed] database is empty — proceeding to seed");
        return true;
      } finally {
        await db.$disconnect().catch(() => {});
      }
    }

    // SQLite: use better-sqlite3 directly
    const Database = require("better-sqlite3");
    const filePath = url.replace(/^file:/, "").replace(/^sqlite:\/\//, "");
    const resolved = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolved)) {
      console.log("[seed] no database file yet — treating as empty, proceeding to seed");
      return true;
    }
    const db = new Database(resolved, { readonly: true });
    const { c } = db.prepare("SELECT COUNT(*) AS c FROM Course").get();
    db.close();
    if (c > 0) {
      console.log(`[seed] database already has ${c} course(s) — skipping seed`);
      return false;
    }
    console.log("[seed] database is empty — proceeding to seed");
    return true;
  } catch (error) {
    console.error(
      "[seed] database check failed:",
      describeDatabaseError(error, process.env.DATABASE_URL),
    );
    // Fail CLOSED. prisma/seed.mjs starts with deleteMany() on 14 tables, so
    // seeding after a failed emptiness check destroys production content — the
    // one outcome --if-empty exists to prevent. A transient outage at container
    // start (exactly what start.sh's retry loop suggests happens) used to fall
    // through to a full wipe. Skipping the seed only means the demo content is
    // missing, which is recoverable; wiping is not.
    console.error("[seed] refusing to seed: database state is unknown, and seeding deletes existing data");
    console.error("[seed] run the seed manually once the database is reachable: node scripts/seed.js --if-empty");
    return false;
  }
}

(async () => {
  // Ensure process is available in the transpiled context
  if (typeof process === 'undefined') {
    globalThis.process = require('process');
  }

  if (!(await shouldSeed())) return;

  const jiti = await createJiti(__filename);
  await jiti.import("../prisma/seed.mjs");
})().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});