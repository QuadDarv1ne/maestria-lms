import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { resolveDatabaseProvider, type DatabaseProvider } from "@/lib/db-provider";
import { types as nodeTypes } from "node:util";
import path from "node:path";

export type { DatabaseProvider };

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
  //
  // The path is environment-driven, so the bundler cannot bound it statically
  // and would otherwise trace the entire project into the server output. The
  // opt-out below is the suppression recommended by Turbopack for this call.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), filePath);
}

/**
 * Get the current database provider from environment variables.
 *
 * The connection URL wins over DATABASE_PROVIDER, mirroring the Prisma CLI
 * wrapper in scripts/prisma-auto.js ("a URL always wins"): migrations run
 * against the engine named in DATABASE_URL, so the client must target the same
 * engine.
 *
 * This previously read env.databaseProvider, which falls back to "sqlite".
 * Because "sqlite" is itself a valid provider, the URL auto-detection below it
 * was dead code: the production runner exports no DATABASE_PROVIDER and ships
 * no SQLite driver, so the client selected the SQLite adapter and every query
 * failed immediately.
 */
export function getDatabaseProvider(): DatabaseProvider {
  return resolveDatabaseProvider({
    url: process.env.DATABASE_URL,
    declared: process.env.DATABASE_PROVIDER,
  }).provider;
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
};

let prismaClient: PrismaClient | undefined;
// Single in-flight initialisation: concurrent first calls must not each build
// their own adapter/client, otherwise the loser is leaked and never closed.
let clientPromise: Promise<PrismaClient> | undefined;

async function createPrismaClient(): Promise<PrismaClient> {
  const provider = getDatabaseProvider();
  const databaseUrl = env.databaseUrl;
  const adapter = await createAdapter(provider, databaseUrl);

  const client = new PrismaClient({
    adapter,
    log: env.isDevelopment ? ["query"] : ["error"],
  });

  prismaClient = client;
  // Cache the client globally in every environment so that other module
  // instances reuse it. Guarding this with `!env.isProduction` was a defect:
  // in production builds nothing ever populated the cache. Model member
  // access no longer depends on this cache — see the lazy resolution below.
  globalForPrisma.prisma = client;

  return client;
}

async function getPrismaClient(): Promise<PrismaClient> {
  if (prismaClient) return prismaClient;
  const cached = globalForPrisma.prisma;
  // Never reuse the lazy proxy itself as a client (would recurse infinitely).
  if (cached && !nodeTypes.isProxy(cached)) {
    prismaClient = cached;
    return prismaClient;
  }

  clientPromise ??= createPrismaClient().catch((error: unknown) => {
    // Let a later call retry after a failed initialisation.
    clientPromise = undefined;
    throw error;
  });

  return clientPromise;
}

// env.validate() is called from src/proxy.ts (middleware) which is always loaded.
// Keeping it here as a safety net for direct Prisma usage without middleware.

export const db = new Proxy({} as PrismaClient, {
  get: (_target, prop) => {
    // For non-function properties, return immediately
    // For functions, we need to handle async adapter creation

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
        // Member access is resolved lazily against the real client: the adapter
        // is created asynchronously, so the client may not exist yet when
        // `db.<model>.<method>` is evaluated. Returning a function that awaits
        // getPrismaClient() keeps model calls independent of initialisation order.
        return (...args: unknown[]) =>
          getPrismaClient().then((client) => {
            const target = Reflect.get(client, prop, client);
            const value =
              target === null || target === undefined
                ? undefined
                : Reflect.get(target, prop2, target);
            if (typeof value !== "function") {
              throw new TypeError(
                `db.${String(prop)}.${String(prop2)} is not a function`,
              );
            }
            return value.apply(target, args);
          });
      },
    }) as unknown;
  },
}) as PrismaClient;

export { Prisma };
