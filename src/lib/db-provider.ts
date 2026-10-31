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
  if (
    lower.startsWith("file:") ||
    lower.endsWith(".db") ||
    lower.endsWith(".sqlite") ||
    lower.endsWith(".sqlite3")
  ) {
    return "sqlite";
  }
  if (lower.startsWith("postgresql://") || lower.startsWith("postgres://")) {
    return "postgresql";
  }
  // CockroachDB speaks the PostgreSQL wire protocol and runs on the pg adapter.
  if (lower.startsWith("cockroachdb://") || lower.startsWith("cockroach://")) {
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

/**
 * Whether a resolved provider can actually be opened by this installation.
 *
 * Detection answers "which engine does this URL name"; capability answers
 * "can the application run against it". Conflating them is what made the
 * tooling half-configure MongoDB and MySQL: the scripts wrote DATABASE_URL,
 * reported success, and the first query then failed deep inside a route.
 */
export type ProviderStatus = "runnable" | "missing-dependency" | "unsupported";

export interface ProviderCapability {
  status: ProviderStatus;
  /** What is required to make the provider work, or why it never will. */
  detail: string;
}

export const PROVIDER_CAPABILITIES: Record<DatabaseProvider, ProviderCapability> = {
  sqlite: {
    status: "runnable",
    detail: "Prisma with @prisma/adapter-better-sqlite3 (local development)",
  },
  postgresql: {
    status: "runnable",
    detail: "Prisma with @prisma/adapter-pg (production default; migration history targets it)",
  },
  mysql: {
    status: "missing-dependency",
    detail:
      'Needs "@prisma/adapter-mariadb" installed and a mysql branch in src/lib/db.ts. ' +
      "prisma/migrations is PostgreSQL-only, so migrate deploy would also have to be replaced by db push.",
  },
  mongodb: {
    status: "unsupported",
    detail:
      "Prisma ORM 7 does not support MongoDB at all (driver adapters exist only for " +
      "relational engines). Switching to MongoDB means rewriting the whole data layer " +
      "in src/lib/db.ts and every db.<model> call site — it is not an environment-variable change.",
  },
};

export function isRunnableProvider(provider: DatabaseProvider): boolean {
  return PROVIDER_CAPABILITIES[provider].status === "runnable";
}

/** Actionable message for a provider the runtime cannot open. */
export function describeUnrunnableProvider(provider: DatabaseProvider): string {
  const capability = PROVIDER_CAPABILITIES[provider];
  return (
    `Database provider "${provider}" is not runnable in this build ` +
    `(${capability.detail})`
  );
}
