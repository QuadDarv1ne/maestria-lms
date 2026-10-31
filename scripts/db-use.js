#!/usr/bin/env node
/**
 * Switch the active database between the saved profiles in .env.
 *
 *   node scripts/db-use.js local    → DATABASE_URL_LOCAL   (SQLite file)
 *   node scripts/db-use.js remote   → DATABASE_URL_REMOTE  (managed PostgreSQL)
 *   node scripts/db-use.js          → show the active profile and the saved ones
 *
 * Why this exists: Prisma 7 bakes the engine into the generated client, so a URL
 * swap alone is not enough — the client must be regenerated for the new
 * provider. Doing that by hand is the step everyone forgets, and the symptom is
 * the confusing "Driver Adapter ... is not compatible with the provider"
 * error. This script swaps the URL, rewrites the datasource provider and
 * regenerates the client in one go.
 *
 * Passwords are never printed: URLs are masked before logging.
 */

const { execSync } = require('child_process')
const path = require('path')

const env = require('./lib/env-manager')

const ROOT = path.join(__dirname, '..')
const ENV_FILE = path.join(ROOT, '.env')

const PROFILES = {
  local: { urlKey: 'DATABASE_URL_LOCAL', label: 'local SQLite file' },
  remote: { urlKey: 'DATABASE_URL_REMOTE', label: 'remote PostgreSQL' },
}

function log(message) {
  console.log(message)
}

function show() {
  const vars = env.parseEnv(ENV_FILE)
  const active = vars.DATABASE_URL
  const provider = env.detectProvider(active)

  log('Database profiles:')
  for (const [name, profile] of Object.entries(PROFILES)) {
    const saved = vars[profile.urlKey]
    const marker = saved && saved === active ? ' (active)' : ''
    const shown = saved ? env.maskDatabaseUrl(saved) : 'not configured'
    log(`  ${name.padEnd(6)} ${profile.label}: ${shown}${marker}`)
  }

  log('')
  log(`Active: ${provider || 'unknown'} — ${active ? env.maskDatabaseUrl(active) : 'not set'}`)

  if (provider && !env.isRunnableProvider(provider)) {
    log(`WARNING: "${provider}" is not runnable in this build (${env.PROVIDER_CAPABILITIES[provider].detail})`)
  }
}

function run(command) {
  execSync(command, { cwd: ROOT, stdio: 'inherit', shell: true })
}

function use(profileName) {
  const profile = PROFILES[profileName]
  if (!profile) {
    throw new Error(`Unknown profile "${profileName}". Use: ${Object.keys(PROFILES).join(' | ')}`)
  }

  const vars = env.parseEnv(ENV_FILE)
  const url = vars[profile.urlKey]
  if (!url) {
    throw new Error(
      `DATABASE_URL_${profileName.toUpperCase()} is not set in .env. ` +
        `Add it first, e.g. DATABASE_URL_${profileName.toUpperCase()}=<connection url>`
    )
  }

  const provider = env.detectProvider(url)
  if (!provider) {
    throw new Error(`Cannot detect a provider from DATABASE_URL_${profileName.toUpperCase()}`)
  }
  if (!env.isRunnableProvider(provider)) {
    throw new Error(
      `Refusing to activate "${provider}": ${env.PROVIDER_CAPABILITIES[provider].detail}`
    )
  }

  env.mergeEnv(ENV_FILE, { DATABASE_PROVIDER: provider, DATABASE_URL: url })
  log(`Active database: ${profileName} (${provider}) — ${env.maskDatabaseUrl(url)}`)

  // The generated client is engine-specific; regenerate it for the new provider.
  log('Regenerating Prisma Client for the new provider...')
  run('node scripts/prisma-auto.js generate')

  if (env.isRemoteDatabaseUrl(url)) {
    log('Remote database: apply schema changes with migrations, not "db push":')
    log('  node scripts/prisma-auto.js migrate deploy')
  } else {
    log('Local database: "npm run dev" keeps the schema in sync automatically.')
  }
}

function main() {
  const profileName = process.argv[2]

  if (!profileName || profileName === 'info' || profileName === 'status') {
    show()
    return
  }

  use(profileName)
  log('')
  show()
}

try {
  main()
} catch (error) {
  console.error(`Error: ${error.message}`)
  process.exit(1)
}
