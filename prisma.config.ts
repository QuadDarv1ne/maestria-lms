import { defineConfig, env } from "prisma/config";
import path from "node:path";

// Prisma 7 does not load .env automatically.
// We load it here so that prisma generate / migrate deploy work
// both locally (via .env) and on Amvera (via process.env).
import "dotenv/config";

// Provide a fallback for build-time operations (e.g., prisma generate)
// so the Docker build doesn't fail when DATABASE_URL is not yet set.
const databaseUrl = (() => {
  try {
    const raw = env("DATABASE_URL");
    // Normalize SQLite "file:" URLs to an absolute filesystem path so that the
    // Prisma CLI, the app (src/lib/db.ts) and the seed (scripts/seed.js) all
    // address the SAME database file. Prisma's CLI resolves relative file: URLs
    // against the schema directory, while the app resolves them against the
    // working directory — this mismatch caused two different DB files locally.
    if (raw.startsWith("file:")) {
      const filePath = raw.replace(/^file:/, "");
      return `file:${path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)}`;
    }
    return raw;
  } catch {
    // Fallback for build-time: prisma generate doesn't actually need a real URL
    return "postgresql://localhost:5432/fallback";
  }
})();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node scripts/seed.js",
  },
  datasource: {
    url: databaseUrl,
  },
});
