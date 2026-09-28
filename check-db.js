#!/usr/bin/env node
/**
 * check-db.js — quick inspection of the configured database.
 *
 * Uses the same provider resolution as the application (DATABASE_URL wins,
 * DATABASE_PROVIDER is the fallback — see src/lib/db-provider.ts) and loads
 * the TypeScript Prisma 7 client through jiti, because a plain require()
 * cannot import the generated TS client. The previous version of this script
 * referenced a non-existent "client/rust" path and always crashed.
 *
 * Usage: node check-db.js
 */
require("dotenv/config");
const path = require("path");
const { createJiti } = require("jiti");

async function main() {
  const url = process.env.DATABASE_URL || "file:./prisma/data.db";
  const declared = process.env.DATABASE_PROVIDER;

  const jiti = createJiti(__filename);
  const { resolveDatabaseProvider } = await jiti.import("./src/lib/db-provider.ts");
  const { provider, source } = resolveDatabaseProvider({ url, declared });

  let adapter;
  if (provider === "sqlite") {
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    const filePath = url.replace(/^file:/, "");
    adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), filePath) });
  } else if (provider === "postgresql") {
    const { PrismaPg } = require("@prisma/adapter-pg");
    adapter = new PrismaPg({ connectionString: url });
  } else {
    throw new Error(`Unsupported database provider: ${provider}`);
  }

  const { PrismaClient } = await jiti.import("./src/generated/prisma/client.ts");
  const db = new PrismaClient({ adapter });

  try {
    const [courses, articles, users, enrollments] = await Promise.all([
      db.course.count(),
      db.article.count(),
      db.user.count(),
      db.enrollment.count(),
    ]);
    console.log(`Provider: ${provider} (source: ${source})`);
    console.log(`Courses: ${courses}`);
    console.log(`Articles: ${articles}`);
    console.log(`Users: ${users}`);
    console.log(`Enrollments: ${enrollments}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("check-db failed:", (error && error.message) || error);
  process.exit(1);
});
