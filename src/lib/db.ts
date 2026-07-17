import { PrismaClient, Prisma } from '@prisma/client'
import { env } from "@/lib/env";

export type DatabaseProvider = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb'

/**
 * Get the current database provider from environment variables
 * Defaults to 'sqlite' if not set
 */
export function getDatabaseProvider(): DatabaseProvider {
  const provider = env.databaseProvider.toLowerCase()

  if (!provider || !['postgresql', 'mysql', 'sqlite', 'mongodb'].includes(provider)) {
    return 'sqlite'
  }

  return provider as DatabaseProvider
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
