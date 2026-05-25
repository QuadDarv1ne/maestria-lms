/**
 * Unified database configuration manager
 * Supports: SQLite, PostgreSQL, MongoDB
 * Auto-detects optimal configuration based on environment
 */

import { execSync } from 'child_process'
import os from 'os'

export type DatabaseProvider = 'sqlite' | 'postgresql' | 'mongodb'

export interface DbConfig {
  provider: DatabaseProvider
  url: string
  port?: number
  host?: string
  name?: string
  reason: string
  docker?: boolean
}

export interface PortConfig {
  app: number
  postgresql: number
  mongodb: number
}

/**
 * Check if a command exists
 */
function checkCommand(cmd: string): boolean {
  try {
    execSync(`${cmd} --version`, { stdio: 'pipe', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

/**
 * Check if Docker is available
 */
function checkDocker(): boolean {
  try {
    execSync('docker --version', { stdio: 'pipe', timeout: 3000 })
    execSync('docker compose version', { stdio: 'pipe', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

/**
 * Check if a TCP port is available
 */
export function isPortAvailable(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net')
    const server = net.createServer()
    
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    
    server.listen(port, host)
  })
}

/**
 * Find next available port starting from given port
 */
export async function findAvailablePort(startPort: number, maxAttempts: number = 20): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const available = await isPortAvailable(port)
    if (available) return port
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts}`)
}

/**
 * Find available ports for all services
 */
export async function findAllAvailablePorts(): Promise<PortConfig> {
  const [app, postgresql, mongodb] = await Promise.all([
    findAvailablePort(3000, 20),
    findAvailablePort(5432, 20),
    findAvailablePort(27017, 20)
  ])

  return { app, postgresql, mongodb }
}

/**
 * Detect optimal database configuration
 * Priority:
 * 1. Environment variable DATABASE_PROVIDER
 * 2. Docker available → PostgreSQL
 * 3. PostgreSQL installed locally → PostgreSQL
 * 4. MongoDB installed locally → MongoDB
 * 5. Windows without Docker → SQLite
 * 6. Default → SQLite
 */
export function detectOptimalConfig(): DbConfig {
  const platform = os.platform()
  const isWindows = platform === 'win32'
  const hasDocker = checkDocker()
  const hasPostgres = checkCommand('pg_isready') || checkCommand('psql')
  const hasMongo = checkCommand('mongosh') || checkCommand('mongo')

  // Priority 1: Docker with PostgreSQL
  if (hasDocker) {
    return {
      provider: 'postgresql',
      url: 'postgresql://postgres:password@localhost:5432/maestria_lms?schema=public',
      port: 5432,
      host: 'localhost',
      name: 'maestria_lms',
      reason: 'Docker available — PostgreSQL recommended for production parity',
      docker: true
    }
  }

  // Priority 2: Local PostgreSQL
  if (hasPostgres) {
    return {
      provider: 'postgresql',
      url: 'postgresql://postgres:password@localhost:5432/maestria_lms?schema=public',
      port: 5432,
      host: 'localhost',
      name: 'maestria_lms',
      reason: 'PostgreSQL detected locally'
    }
  }

  // Priority 3: Local MongoDB
  if (hasMongo) {
    return {
      provider: 'mongodb',
      url: 'mongodb://localhost:27017/maestria_lms',
      port: 27017,
      host: 'localhost',
      name: 'maestria_lms',
      reason: 'MongoDB detected locally'
    }
  }

  // Priority 4: Windows without Docker → SQLite
  if (isWindows) {
    return {
      provider: 'sqlite',
      url: 'file:./prisma/data.db',
      reason: 'Windows without Docker — SQLite is simplest'
    }
  }

  // Default: SQLite
  return {
    provider: 'sqlite',
    url: 'file:./prisma/data.db',
    reason: 'No database server detected — SQLite (zero-config)'
  }
}

/**
 * Get URL template for provider
 */
export function getUrlTemplate(provider: DatabaseProvider, port?: number): string {
  const templates: Record<DatabaseProvider, string> = {
    sqlite: 'file:./prisma/data.db',
    postgresql: `postgresql://postgres:password@localhost:${port || 5432}/maestria_lms?schema=public`,
    mongodb: `mongodb://localhost:${port || 27017}/maestria_lms`
  }
  return templates[provider]
}

/**
 * Validate database URL format
 */
export function validateDatabaseUrl(url: string, provider: DatabaseProvider): boolean {
  if (!url) return false

  const lowerUrl = url.toLowerCase()

  switch (provider) {
    case 'sqlite':
      return lowerUrl.startsWith('file:') || lowerUrl.endsWith('.db')
    case 'postgresql':
      return lowerUrl.startsWith('postgresql://') || lowerUrl.startsWith('postgres://')
    case 'mongodb':
      return lowerUrl.startsWith('mongodb://') || lowerUrl.startsWith('mongodb+srv://')
    default:
      return false
  }
}

/**
 * Get database info for display
 */
export function getDatabaseInfo(provider: DatabaseProvider): { name: string; color: string; icon: string } {
  const info = {
    sqlite: { name: 'SQLite', color: '\x1b[36m', icon: '🗄️' },
    postgresql: { name: 'PostgreSQL', color: '\x1b[34m', icon: '🐘' },
    mongodb: { name: 'MongoDB', color: '\x1b[32m', icon: '🍃' }
  }
  return info[provider]
}
