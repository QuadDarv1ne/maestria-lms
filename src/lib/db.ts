import { PrismaClient, Prisma } from '@prisma/client'

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
  const url = process.env.DATABASE_URL

  if (!url) {
    errors.push('DATABASE_URL environment variable is not set')
  } else {
    try {
      formatDatabaseUrl(url, provider)
    } catch (e) {
      if (e instanceof Error) {
        errors.push(e.message)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

export { Prisma }

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Export unified database abstraction for use across the app
export { database as unifiedDb } from './database'
