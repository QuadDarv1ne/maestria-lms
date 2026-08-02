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
  const provider = env.detectProvider(databaseUrl) || envVars.DATABASE_PROVIDER || 'sqlite'

  updateSchemaProvider(provider)

  // Skip Prisma commands for MongoDB
  if (provider === 'mongodb') {
    console.log('[auto-db] MongoDB uses native driver — no Prisma commands needed')
    process.exit(0)
  }

  // Execute the original Prisma command
  const args = process.argv.slice(2)

  const quoteArg = (a) => (/\s|"/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)
  execSync(`"${PRISMA_BIN}" ${args.map(quoteArg).join(' ')}`, {
    stdio: 'inherit',
    cwd: ROOT,
    env: { ...process.env },
  })
} catch (error) {
  console.error(`[auto-db] Error: ${error.message}`)
  process.exit(error.status || 1)
}
