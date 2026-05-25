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

/**
 * Update schema.prisma datasource block
 */
function updateSchemaProvider(provider) {
  if (provider === 'mongodb') {
    console.log('[auto-db] MongoDB detected — skipping Prisma commands')
    return
  }

  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8')

  const newDatasource = `datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
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
  const command = `npx prisma ${args.join(' ')}`

  execSync(command, {
    stdio: 'inherit',
    cwd: ROOT,
    env: { ...process.env }
  })
} catch (error) {
  console.error(`[auto-db] Error: ${error.message}`)
  process.exit(error.status || 1)
}
