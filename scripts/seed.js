// Seed entrypoint that works with the TS-only Prisma 7 generated client.
// Prisma's default seed command (`node prisma/seed.mjs`) cannot import the
// generated TypeScript client, so we load it through jiti (already a runtime
// dependency of the Prisma CLI).
const { createJiti } = require("jiti");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const ifEmpty = process.argv.includes("--if-empty");

// SQLite guard: when --if-empty is passed, seed only when the database has no
// courses, so fresh deploys get demo content but production data is untouched.
// The seed itself is destructive (wipes all tables), hence the early check.
if (ifEmpty) {
  try {
    const url = process.env.DATABASE_URL || "file:./prisma/data.db";
    if (!url.startsWith("sqlite") && !url.includes(".db") && !url.startsWith("file:")) {
      console.log("[seed] --if-empty only supports SQLite — skipping check for non-SQLite providers");
    } else {
      const filePath = url.replace(/^file:/, "").replace(/^sqlite:\/\/\//, "");
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
  }
}

(async () => {
  const jiti = await createJiti(__filename);
  await jiti.import("./prisma/seed.mjs");
})().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});