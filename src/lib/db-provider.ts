/**
 * Database provider resolution.
 *
 * Kept free of Prisma and application imports so the runtime client
 * (src/lib/db.ts) and the CLI wrapper (scripts/prisma-auto.js) can share one
 * precedence rule: the connection URL wins, an explicitly declared provider is
 * the fallback. Divergence here is a deployment hazard - migrations would
 * target one engine while the app opened another.
 */

export type DatabaseProvider = "postgresql" | "mysql" | "sqlite" | "mongodb";

/** Where the resolved provider came from. */
export type DatabaseProviderSource = "url" | "env" | "default";

/** Provider names accepted in DATABASE_PROVIDER, including common aliases. */
const PROVIDER_ALIASES: Record<string, DatabaseProvider> = {
  postgres: "postgresql",
  postgresql: "postgresql",
  mysql: "mysql",
  mariadb: "mysql",
  sqlite: "sqlite",
  mongodb: "mongodb",
  mongo: "mongodb",
};

/**
 * Detect the database provider from a connection URL.
 * Mirrors detectProvider() in scripts/lib/env-manager.js.
 */
export function detectProviderFromUrl(url: string | undefined | null): DatabaseProvider | null {
  if (!url) return null;
  const lower = url.trim().toLowerCase();
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
 * Resolve the effective database provider.
 *
 * Order matches scripts/prisma-auto.js: the URL decides, because migrations run
 * against the engine named in DATABASE_URL and the client must use the same
 * one. DATABASE_PROVIDER is consulted only when the URL is absent or
 * unrecognised.
 */
export function resolveDatabaseProvider(input: {
  url?: string | null;
  declared?: string | null;
}): { provider: DatabaseProvider; source: DatabaseProviderSource } {
  const fromUrl = detectProviderFromUrl(input.url);
  if (fromUrl) return { provider: fromUrl, source: "url" };

  const declared = input.declared?.trim().toLowerCase();
  if (declared) {
    const mapped = PROVIDER_ALIASES[declared];
    if (mapped) return { provider: mapped, source: "env" };
  }

  return { provider: "sqlite", source: "default" };
}