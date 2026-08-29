import { PrismaClient, Prisma } from "@/generated/prisma/client";
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
 * Uses dynamic imports to avoid loading unnecessary native modules.
 */
async function createAdapter(provider: DatabaseProvider, url: string) {
  switch (provider) {
    case "sqlite": {
      const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
      // Normalize Prisma's "file:./path" format to an absolute filesystem path
      // that better-sqlite3 can properly resolve in the container
      const sqlitePath = normalizeSqliteUrl(url);
      return new PrismaBetterSqlite3({ url: sqlitePath });
    }
    case "postgresql": {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      // Local PostgreSQL doesn't need SSL
      return new PrismaPg({
        connectionString: url,
        ssl: false,
      });
    }
    default: {
      const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
      // Fallback: try SQLite adapter with normalized path
      const fallbackPath = normalizeSqliteUrl(url);
      return new PrismaBetterSqlite3({ url: fallbackPath });
    }
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  _adapterPromise: Promise<any> | undefined;
};

let prismaClient: PrismaClient | undefined;

async function getPrismaClient(): Promise<PrismaClient> {
  if (prismaClient) return prismaClient;
  const cached = globalForPrisma.prisma;
  // Never reuse the lazy proxy itself as a client (would recurse infinitely).
  if (cached && !nodeTypes.isProxy(cached)) {
    prismaClient = cached;
    return prismaClient;
  }

  const provider = getDatabaseProvider();
  const databaseUrl = env.databaseUrl;
  const adapter = await createAdapter(provider, databaseUrl);

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
    // For non-function properties, return immediately
    // For functions, we need to handle async adapter creation
    const getClient = async () => {
      const client = await getPrismaClient();
      return client;
    };

    // Return a proxy that handles async client initialization
    return new Proxy(() => {}, {
      apply: async (target, thisArg, argumentsList) => {
        const client = await getPrismaClient();
        const value = Reflect.get(client, prop, client);
        if (typeof value === "function") {
          return value.apply(client, argumentsList);
        }
        return value;
      },
      get: (_target2, prop2) => {
        const value = Reflect.get(
          globalForPrisma.prisma || {},
          prop2,
          globalForPrisma.prisma
        );
        return typeof value === "function"
          ? (...args: unknown[]) => Promise.resolve().then(() => value.apply(null, args))
          : value;
      },
    }) as unknown;
  },
}) as PrismaClient;

export { Prisma };
