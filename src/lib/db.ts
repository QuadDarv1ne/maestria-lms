import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

export type DatabaseProvider = "postgresql" | "mysql" | "sqlite" | "mongodb";

/**
 * Get the current database provider from environment variables
 * Defaults to 'sqlite' if not set
 */
export function getDatabaseProvider(): DatabaseProvider {
  const provider = env.databaseProvider.toLowerCase();

  if (!provider || !["postgresql", "mysql", "sqlite", "mongodb"].includes(provider)) {
    return "sqlite";
  }

  return provider as DatabaseProvider;
}

/**
 * Create the appropriate Prisma driver adapter based on the database provider.
 * Prisma 7 requires driver adapters for all providers.
 */
function createAdapter(provider: DatabaseProvider, url: string) {
  switch (provider) {
    case "sqlite":
      return new PrismaBetterSqlite3({ url });
    case "postgresql":
      return new PrismaPg({ connectionString: url });
    default:
      // Fallback: try SQLite adapter
      return new PrismaBetterSqlite3({ url });
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const provider = getDatabaseProvider();
const databaseUrl = env.databaseUrl;
const adapter = createAdapter(provider, databaseUrl);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.isDevelopment ? ["query"] : ["error"],
  });

export { Prisma };

if (!env.isProduction) globalForPrisma.prisma = db;
