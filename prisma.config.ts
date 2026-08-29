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
