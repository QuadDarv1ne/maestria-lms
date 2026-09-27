#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Prisma Auto — Automatic Prisma wrapper with provider detection
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Uses scripts/lib/env-manager.js for unified provider detection.
 *  - Detects provider from DATABASE_URL / DATABASE_PROVIDER
 *  - Updates schema.prisma datasource block
 *  - Skips Prisma entirely for MongoDB
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const env = require('./lib/env-manager')

const ROOT = path.join(__dirname, '..')
const SCHEMA_FILE = path.join(ROOT, 'prisma', 'schema.prisma')
const ENV_FILE = path.join(ROOT, '.env')

// Resolve the local Prisma CLI binary (npx fails on Windows without a shell
// and may hit the network; the local binary is deterministic).
const PRISMA_BIN = path.join(
  ROOT,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
)

// Fall back to the CLI entry point when the .bin shim is not shipped
// (slim runtime images may copy node_modules without .bin).
const PRISMA_JS = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js')
const MIGRATION_LOCK = path.join(ROOT, 'prisma', 'migrations', 'migration_lock.toml')

/**
 * Provider recorded in prisma/migrations/migration_lock.toml.
 * Migration history is engine-specific: replaying it against another engine
 * fails with an opaque Prisma error (P3019, or P1001 on a bad URL match).
 */
function readMigrationsProvider() {
  try {
    const lock = fs.readFileSync(MIGRATION_LOCK, 'utf8')
    const match = lock.match(/provider\s*=\s*"([^"]+)"/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Update schema.prisma datasource provider while preserving everything else.
 */
function updateSchemaProvider(provider) {
  if (provider === 'mongodb') {
    console.log('[auto-db] MongoDB detected — skipping Prisma commands')
    return
  }

  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8')

  const newDatasource = `datasource db {
  provider = "${provider}"
}`

  const updatedSchema = schema.replace(/datasource db \{[\s\S]*?\}/, newDatasource)
  fs.writeFileSync(SCHEMA_FILE, updatedSchema)

  console.log(`[auto-db] Detected provider: ${provider}`)
}

// ─── Main ───
try {
  const envVars = env.parseEnv(ENV_FILE)
  const databaseUrl = process.env.DATABASE_URL || envVars.DATABASE_URL
  // A URL always wins; otherwise the declared provider is used. The Dockerfile
  // passes DATABASE_PROVIDER=postgresql, which previously had no effect because
  // only .env was consulted — the image silently baked a sqlite schema.
  const declaredProvider = process.env.DATABASE_PROVIDER || envVars.DATABASE_PROVIDER
  const provider = env.detectProvider(databaseUrl) || declaredProvider || 'sqlite'

  updateSchemaProvider(provider)

  // Skip Prisma commands for MongoDB
  if (provider === 'mongodb') {
    console.log('[auto-db] MongoDB uses native driver — no Prisma commands needed')
    process.exit(0)
  }

  // Execute the original Prisma command
  const args = process.argv.slice(2)

  // Migrations are the source of truth for the PostgreSQL deployment only.
  // Refuse to run them against another engine instead of corrupting history
  // or failing with an opaque Prisma error.
  const MIGRATE_SUBCOMMANDS = new Set(['dev', 'deploy', 'reset', 'status', 'resolve'])
  if (args[0] === 'migrate' && MIGRATE_SUBCOMMANDS.has(args[1])) {
    const lockProvider = readMigrationsProvider()
    if (lockProvider && lockProvider !== provider) {
      console.error(
        `[auto-db] Provider mismatch: prisma/migrations targets "${lockProvider}" ` +
          `but the current provider is "${provider}".`,
      )
      console.error(
        '[auto-db] Use "npm run db:push" for non-PostgreSQL development, or point ' +
          "DATABASE_URL at a " +
          lockProvider +
          " database to work with migrations.",
      )
      process.exit(1)
    }
  }

  const quoteArg = (a) => (/\s|"/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)
  const prismaCommand = fs.existsSync(PRISMA_BIN)
    ? `"${PRISMA_BIN}"`
    : `"${process.execPath}" "${PRISMA_JS}"`

  execSync(`${prismaCommand} ${args.map(quoteArg).join(' ')}`, {
    stdio: 'inherit',
    cwd: ROOT,
    env: { ...process.env },
  })
} catch (error) {
  console.error(`[auto-db] Error: ${error.message}`)
  process.exit(error.status || 1)
}
