import { PrismaClient, Prisma } from '@prisma/client'
import { env } from "@/lib/env";

export type DatabaseProvider = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb'

/**
 * Get the current database provider from environment variables
 * Defaults to 'sqlite' if not set
 */
export function getDatabaseProvider(): DatabaseProvider {
  const provider = process.env.DATABASE_PROVIDER?.toLowerCase()

  if (!provider || !['postgresql', 'mysql', 'sqlite', 'mongodb'].includes(provider)) {
    return 'sqlite'
  }

  return provider as DatabaseProvider
}

/**
 * Get the appropriate connection URL format based on provider
 */
export function formatDatabaseUrl(url: string, provider: DatabaseProvider): string {
  if (provider === 'mongodb') {
    if (!url.startsWith('mongodb://') && !url.startsWith('mongodb+srv://')) {
      throw new Error('Invalid DATABASE_URL for mongodb. Expected format: mongodb://host:port/database')
    }
    return url
  }

  if (provider === 'sqlite' && !url.startsWith('file:')) {
    return `file:${url}`
  }

  if ((provider === 'postgresql' || provider === 'mysql') && url.startsWith('file:')) {
    throw new Error(
      `Invalid DATABASE_URL for ${provider}. Expected format: ` +
        (provider === 'postgresql'
          ? 'postgresql://user:password@host:port/database'
          : 'mysql://user:password@host:port/database')
    )
  }

  return url
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const provider = getDatabaseProvider()
  const url = env.databaseUrl

  try {
    formatDatabaseUrl(url, provider)
  } catch (e: unknown) {
    if (e instanceof Error) {
      errors.push(e.message)
    }
  }

  return { valid: errors.length === 0, errors }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Connection pool configuration for production performance
const prismaOptions: ConstructorParameters<typeof PrismaClient>[0] = {
  log: env.isDevelopment ? ['query'] : ['error'],
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(prismaOptions)

export { Prisma }

if (!env.isProduction) globalForPrisma.prisma = db

/**
 * Execute a database query with automatic retry logic.
 * Retries transient failures (connection timeouts, deadlocks).
 */
export async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  options: { maxRetries?: number; delayMs?: number } = {},
): Promise<T> {
  const { maxRetries = 3, delayMs = 100 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on transient errors
      const errorCode = "code" in lastError ? (lastError as { code: string }).code : undefined;
      const isTransient =
        errorCode === 'ECONNRESET' ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'ECONNREFUSED' ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('deadlock') ||
        lastError.message.includes('connection');

      if (!isTransient || attempt === maxRetries - 1) {
        throw lastError;
      }

      // Exponential backoff
      const backoff = delayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError ?? new Error('Query failed after retries');
}

/**
 * Batch operation helper: processes items in chunks to avoid memory issues.
 */
export async function batchOperation<T, R>(
  items: T[],
  operation: (batch: T[]) => Promise<R[]>,
  options: { batchSize?: number } = {},
): Promise<R[]> {
  const { batchSize = 100 } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await operation(batch);
    results.push(...batchResults);
  }

  return results;
}
