import { defineConfig, env } from "prisma/config";

// Prisma 7 does not load .env automatically.
// We load it here so that prisma generate / migrate deploy work
// both locally (via .env) and on Amvera (via process.env).
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
