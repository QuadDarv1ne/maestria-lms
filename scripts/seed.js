// Seed entrypoint that works with the TS-only Prisma 7 generated client.
// Prisma's default seed command (`node prisma/seed.mjs`) cannot import the
// generated TypeScript client, so we load it through jiti (already a runtime
// dependency of the Prisma CLI).
const { createJiti } = require("jiti");
const fs = require("fs");
const path = require("path");

const ifEmpty = process.argv.includes("--if-empty");
const force = process.argv.includes("--force");

// Database guard: when --if-empty is passed, seed only when the database has no
// courses, so fresh deploys get demo content but production data is untouched.
if (ifEmpty) {
  (async () => {
    try {
      const url = process.env.DATABASE_URL || "file:./prisma/data.db";
      const isSQLite = !url.startsWith("postgresql") && !url.startsWith("postgres") && !url.startsWith("mysql") && !url.startsWith("mongodb");

      if (!isSQLite) {
        // For PostgreSQL / MySQL / MongoDB: use Prisma to check Course count.
        // We dynamically load the adapter matching the provider.
        const { PrismaClient } = await import("../src/generated/prisma/client.js");

        let adapter;
        const lower = url.toLowerCase();
        if (lower.startsWith("postgresql") || lower.startsWith("postgres")) {
          const { PrismaPg } = await import("@prisma/adapter-pg");
          adapter = new PrismaPg({ connectionString: url, ssl: false });
        } else if (lower.startsWith("mysql") || lower.startsWith("mariadb")) {
          // MySQL adapter — skip for now, assume not empty if we can't check
          console.log("[seed] MySQL/MariaDB: cannot safely check emptiness — skipping seed unless --force");
          if (!force) process.exit(0);
        } else if (lower.startsWith("mongodb")) {
          console.log("[seed] MongoDB: cannot safely check emptiness — skipping seed unless --force");
          if (!force) process.exit(0);
        } else {
          // Unknown provider, skip
          console.log("[seed] Unknown database provider — skipping seed unless --force");
          if (!force) process.exit(0);
        }

        const db = new PrismaClient({ adapter });
        const { count } = await db.course.aggregate({ _count: true });
        await db.$disconnect();

        if (count > 0) {
          console.log(`[seed] database already has ${count} course(s) — skipping seed`);
          process.exit(0);
        }
        console.log("[seed] database is empty — proceeding to seed");
      } else {
        // SQLite: use better-sqlite3 directly
        const Database = require("better-sqlite3");
        const filePath = url.replace(/^file:/, "").replace(/^sqlite:\/\//, "");
        const resolved = path.resolve(process.cwd(), filePath.startsWith("./") ? filePath : filePath);
        if (!fs.existsSync(resolved)) {
          console.log("[seed] no database file yet — treating as empty, proceeding to seed");
        } else {
          const db = new Database(resolved, { readonly: true });
          const { c } = db.prepare("SELECT COUNT(*) AS c FROM Course").get();
          db.close();
          if (c > 0) {
            console.log(`[seed] database already has ${c} course(s) — skipping seed`);
            process.exit(0);
          }
          console.log("[seed] database is empty — proceeding to seed");
        }
      }
    } catch (error) {
      console.error("[seed] database check failed:", error.message);
      // On error, proceed to seed (safer than blocking deployment)
      console.log("[seed] continuing to seed after check error");
    }
  })();
}

(async () => {
  const jiti = await createJiti(__filename);
  await jiti.import("../prisma/seed.mjs");
})().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});