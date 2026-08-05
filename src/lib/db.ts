import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";
import { types as nodeTypes } from "node:util";
import path from "node:path";

export type DatabaseProvider = "postgresql" | "mysql" | "sqlite" | "mongodb";

/**
 * Normalize a Prisma database URL to a path suitable for better-sqlite3.
 * Prisma uses "file:./path" or "file:../path" format, but better-sqlite3
 * needs an absolute filesystem path.
 */
function normalizeSqliteUrl(url: string): string {
  // Remove the "file:" prefix used by Prisma
  const filePath = url.replace(/^file:/, "");

  // If it's an absolute path, return as-is
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  // Resolve relative path against the current working directory
  // This ensures the path is correct regardless of where the container runs from
  return path.resolve(process.cwd(), filePath);
}

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
      // Normalize Prisma's "file:./path" format to an absolute filesystem path
      // that better-sqlite3 can properly resolve in the container
      const sqlitePath = normalizeSqliteUrl(url);
      return new PrismaBetterSqlite3({ url: sqlitePath });
    case "postgresql":
      // Amvera requires SSL for PostgreSQL connections.
      // rejectUnauthorized: false allows self-signed certificates.
      return new PrismaPg({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
      });
    default:
      // Fallback: try SQLite adapter with normalized path
      const fallbackPath = normalizeSqliteUrl(url);
      return new PrismaBetterSqlite3({ url: fallbackPath });
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaClient: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
  if (prismaClient) return prismaClient;
  const cached = globalForPrisma.prisma;
  // Never reuse the lazy proxy itself as a client (would recurse infinitely).
  if (cached && !nodeTypes.isProxy(cached)) {
    prismaClient = cached;
    return prismaClient;
  }

  const provider = getDatabaseProvider();
  const databaseUrl = env.databaseUrl;
  const adapter = createAdapter(provider, databaseUrl);

  const client = new PrismaClient({
    adapter,
    log: env.isDevelopment ? ["query"] : ["error"],
  });

  prismaClient = client;
  if (!env.isProduction) globalForPrisma.prisma = client;

  return client;
}

// Validate env on first load (production only)
env.validate();

export const db = new Proxy({} as PrismaClient, {
  get: (_target, prop) => {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
}) as PrismaClient;

export { Prisma };
