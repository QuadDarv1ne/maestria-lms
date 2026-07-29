import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

export type DatabaseProvider = "postgresql" | "mysql" | "sqlite" | "mongodb";

/**
 * Detect database provider from connection URL.
 */
function detectProviderFromUrl(url: string): DatabaseProvider | null {
  const lower = url.toLowerCase();
  if (lower.startsWith("file:") || lower.endsWith(".db") || lower.endsWith(".sqlite")) {
    return "sqlite";
  }
  if (lower.startsWith("postgresql://") || lower.startsWith("postgres://")) {
    return "postgresql";
  }
  if (lower.startsWith("mysql://") || lower.startsWith("mariadb://")) {
    return "mysql";
  }
  if (lower.startsWith("mongodb://") || lower.startsWith("mongodb+srv://")) {
    return "mongodb";
  }
  return null;
}

/**
 * Get the current database provider from environment variables.
 * Auto-detects from DATABASE_URL if DATABASE_PROVIDER is not set.
 * Defaults to 'sqlite' if nothing is detected.
 */
export function getDatabaseProvider(): DatabaseProvider {
  const provider = env.databaseProvider.toLowerCase();

  if (provider && ["postgresql", "mysql", "sqlite", "mongodb"].includes(provider)) {
    return provider as DatabaseProvider;
  }

  // Auto-detect from DATABASE_URL
  const detected = detectProviderFromUrl(env.databaseUrl);
  if (detected) return detected;

  return "sqlite";
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
      // Amvera requires SSL for PostgreSQL connections.
      // rejectUnauthorized: false allows self-signed certificates.
      return new PrismaPg({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
      });
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
