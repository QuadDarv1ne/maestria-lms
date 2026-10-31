/**
 * Smart database setup script with automatic provider detection and optimal config
 * Usage: node scripts/db-setup.js [setup|switch|info]
 *
 * Automatically detects database provider from DATABASE_URL
 * Supported engines: sqlite, postgresql
 * Recognised but not runnable here: mysql (missing adapter), mongodb (Prisma 7 has no support)
 *
 * Provider detection, URL templates and the capability matrix come from
 * scripts/lib/env-manager.js — the single source of truth shared with
 * scripts/setup.js. Duplicating them here previously let the two scripts drift
 * (this file accepted cockroachdb://, env-manager did not) and let setup report
 * success for an engine the application cannot open.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const env = require('./lib/env-manager')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const envFile = path.join(__dirname, '..', '.env')
const prismaDir = path.join(__dirname, '..', 'prisma')
const schemaFile = path.join(prismaDir, 'schema.prisma')

function log(message, type = 'info') {
  const icons = { info: 'ℹ', success: '✓', error: '✗', warn: '⚠' }
  console.log(`[${icons[type] || 'ℹ'}] ${message}`)
}

function run(command, options = {}) {
  log(`Running: ${command}`)
  return execSync(command, {
    stdio: options.silent ? 'pipe' : 'inherit',
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  })
}

/**
 * Provider detection, URL templates, optimal-config detection and the
 * capability matrix are delegated to scripts/lib/env-manager.js so that this
 * file, scripts/setup.js and scripts/prisma-auto.js cannot disagree about which
 * engine a URL names.
 */
const detectProvider = env.detectProvider
const getUrlTemplate = env.getUrlTemplate
const detectOptimalConfig = env.detectOptimalConfig

/** Current DATABASE_URL and friends from .env */
function readEnvFile() {
  return env.parseEnv(envFile)
}

/**
 * Update the datasource in schema.prisma (only for Prisma providers)
 */
function updateSchemaProvider(provider) {
  const schema = fs.readFileSync(schemaFile, 'utf8')

  const newDatasource = `datasource db {
  provider = "${provider}"
}`

  const updatedSchema = schema.replace(/datasource db \{[\s\S]*?\}/, newDatasource)
  fs.writeFileSync(schemaFile, updatedSchema)
}

/**
 * Update .env file with new DATABASE_URL
 */
function updateEnvFile(databaseUrl, provider) {
  const content = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''
  const lines = content.split('\n')

  let foundUrl = false
  let foundProvider = false

  const updatedLines = lines.map(line => {
    const trimmed = line.trim()
    if (trimmed.startsWith('DATABASE_URL=')) {
      foundUrl = true
      return `DATABASE_URL=${databaseUrl}`
    }
    if (trimmed.startsWith('DATABASE_PROVIDER=')) {
      foundProvider = true
      return `DATABASE_PROVIDER=${provider}`
    }
    return line
  })

  if (!foundUrl) {
    updatedLines.unshift(`DATABASE_URL=${databaseUrl}`)
  }
  if (!foundProvider) {
    updatedLines.unshift(`DATABASE_PROVIDER=${provider}`)
  }

  fs.writeFileSync(envFile, updatedLines.join('\n'))
}

/**
 * Setup database with automatic provider detection
 */
async function setup(options = {}) {
  const {
    provider: forcedProvider,
    seed = false,
    url: forcedUrl,
    force = false,
    auto = false,
    allowRemote = false,
  } = options

  log('Starting database setup...', 'info')

  // Read current environment
  const envVars = readEnvFile()
  const currentUrl = envVars.DATABASE_URL

  // Detect or use forced provider
  let provider = forcedProvider
  let databaseUrl = forcedUrl

  // Auto-detect optimal config
  if (auto && !forcedProvider) {
    const optimal = detectOptimalConfig()
    provider = optimal.provider
    databaseUrl = getUrlTemplate(provider)
    log(`Auto-detected optimal config: ${provider} (${optimal.reason})`, 'success')
  }
  // If no URL provided but provider is forced, use template
  else if (!databaseUrl && forcedProvider) {
    databaseUrl = getUrlTemplate(forcedProvider)
  }
  // If still no URL, try to detect from current URL
  else if (!databaseUrl && currentUrl) {
    databaseUrl = currentUrl
    if (!provider) {
      provider = detectProvider(databaseUrl)
    }
  }

  if (!provider) {
    log('No database provider specified or detected', 'warn')
    log('This application can run on:', 'info')
    log('  1. sqlite - Local file database (development)', 'info')
    log('  2. postgresql - PostgreSQL (production)', 'info')
    log('Recognised but not runnable here:', 'warn')
    log('  3. mysql - needs @prisma/adapter-mariadb', 'warn')
    log('  4. mongodb - Prisma ORM 7 has no MongoDB support', 'warn')

    const answer = await new Promise(resolve => {
      rl.question('\nSelect database (1-4): ', (ans) => resolve(ans))
    })

    const providers = { '1': 'sqlite', '2': 'postgresql', '3': 'mysql', '4': 'mongodb' }
    provider = providers[answer] || 'sqlite'
  }

  if (!databaseUrl) {
    databaseUrl = getUrlTemplate(provider)
  }

  // Verify the provider is runnable BEFORE writing .env, schema.prisma or the
  // generated client. The old order configured an engine the app cannot open,
  // printed "setup complete", and the failure surfaced later as a 500.
  const capability = env.PROVIDER_CAPABILITIES[provider]
  if (!capability) {
    throw new Error(
      `Unknown provider: ${provider}. Known: ${Object.keys(env.PROVIDER_CAPABILITIES).join(', ')}`
    )
  }
  if (!env.isRunnableProvider(provider)) {
    throw new Error(
      `Refusing to configure "${provider}": ${capability.detail}\n` +
        `Runnable here: ${Object.keys(env.PROVIDER_CAPABILITIES).filter(env.isRunnableProvider).join(', ')}.`
    )
  }

  log(`Configuring database for: ${provider}`, 'info')
  // Never print the live password: setup logs end up in CI output and tickets.
  log(`URL: ${env.maskDatabaseUrl(databaseUrl)}`, 'info')

  // Only runnable providers (sqlite, postgresql) reach this point, so the
  // Prisma schema and client are always updated.
  log('Updating Prisma schema...', 'info')
  updateSchemaProvider(provider)

  // Generate Prisma client
  log('Generating Prisma client...', 'info')
  run('npx prisma generate', { silent: true })

  // Update .env
  log('Updating environment variables...', 'info')
  updateEnvFile(databaseUrl, provider)

  // `db push` rewrites the schema by force; `migrate reset` drops data. Both
  // are destructive against a database other environments share, so a remote
  // URL needs an explicit opt-in.
  if (env.isRemoteDatabaseUrl(databaseUrl) && !allowRemote) {
    log('Remote database detected — skipping "prisma db push"/reset.', 'warn')
    log('Apply schema with migrations instead: node scripts/prisma-auto.js migrate deploy', 'info')
    log('Override deliberately with --allow-remote (it can DROP COLUMNS on the target).', 'warn')
  } else {
    // Push schema to database
    log('Syncing schema with database...', 'info')
    try {
      if (force) {
        log('Resetting database...', 'warn')
        // Routed through the provider-aware wrapper: a direct `migrate reset`
        // bypasses the provider/lock check and fails with an opaque error.
        const resetCmd = 'node scripts/prisma-auto.js migrate reset --force'
        log(`Running: ${resetCmd}`, 'info')
        try {
          execSync(resetCmd, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..'),
          })
          log('Database reset successful', 'success')
        } catch (resetError) {
          log(`Database reset failed: ${resetError.message}`, 'error')
          log('Continuing with db push anyway...', 'warn')
        }

        // Push schema after reset to create tables
        log('Pushing schema to database...', 'info')
        run('npx prisma db push')
      } else {
        run('npx prisma db push')
      }
      log('Schema synced successfully!', 'success')
    } catch (error) {
      if (error.message && error.message.includes("Can't reach database server")) {
        log('Database server is not running. Please start it first.', 'error')
        log(`For ${provider}, ensure the database server is accessible.`, 'warn')
        log(`You can use: docker-compose -f docker-compose.db.yml up -d ${provider === 'postgresql' ? 'postgres' : provider}`, 'info')
      }
      throw error
    }
  }

  // Seed if requested
  if (seed) {
    log('Seeding database...', 'info')
    try {
      run('npx prisma db seed')
      log('Database seeded successfully!', 'success')
    } catch (error) {
      if (force) {
        log('Seed failed, but database was reset', 'warn')
      } else {
        throw error
      }
    }
  }

  log('', 'info')
  log(`Database setup complete for ${provider}!`, 'success')
  log('Start development server: npm run dev', 'info')
  log('Open Prisma Studio: npm run db:studio', 'info')
}

/**
 * Show current database configuration
 */
function info() {
  const envVars = readEnvFile()
  const url = envVars.DATABASE_URL
  const provider = detectProvider(url)

  log('Current Database Configuration:', 'info')
  log(`  Provider: ${provider || 'unknown'}`, provider ? 'success' : 'warn')
  log(`  URL: ${url ? env.maskDatabaseUrl(url) : 'not set'}`, url ? 'success' : 'warn')

  if (provider) {
    const runnable = Object.keys(env.PROVIDER_CAPABILITIES).filter(env.isRunnableProvider)
    const status = env.PROVIDER_CAPABILITIES[provider]
    if (!status) {
      log(`  Unknown provider "${provider}"`, 'warn')
    } else if (status.status === 'runnable') {
      log(`  Runnable here: yes (this build supports ${runnable.join(', ')})`, 'success')
    } else {
      log(`  Runnable here: NO — ${status.detail}`, 'error')
    }
  }
}

/**
 * Interactive switch database command
 */
async function switchInteractive() {
  const envVars = readEnvFile()
  const currentUrl = envVars.DATABASE_URL
  const currentProvider = detectProvider(currentUrl)

  log(`Current database: ${currentProvider || 'unknown'}`, 'info')
  log('Select new database:', 'info')
  log('  1. sqlite - Local file (development)', 'info')
  log('  2. postgresql - PostgreSQL (production)', 'info')
  log('  3. mysql - NOT runnable here (needs @prisma/adapter-mariadb)', 'warn')
  log('  4. mongodb - NOT runnable here (Prisma ORM 7 has no MongoDB support)', 'warn')

  const answer = await new Promise(resolve => {
    rl.question('\nSelect (1-4): ', (ans) => resolve(ans))
  })

  const providers = { '1': 'sqlite', '2': 'postgresql', '3': 'mysql', '4': 'mongodb' }
  const provider = providers[answer]

  if (!provider) {
    log('Invalid selection', 'error')
    rl.close()
    return
  }

  // setup() refuses a non-runnable provider; run it first so the operator sees
  // the reason instead of a template URL that belongs to a different engine.
  await setup({ provider, url: getUrlTemplate(provider) })
  rl.close()
}

/** Provider named on the command line, or null. */
function providerArg(argv) {
  const flagIndex = argv.indexOf('--provider')
  const inline = argv[3]
  if (flagIndex !== -1) return argv[flagIndex + 1] || null
  if (inline && !inline.startsWith('--') && env.PROVIDER_CAPABILITIES[inline]) return inline
  return null
}

// Main command handler
async function main() {
  const command = process.argv[2] || 'setup'
  const argv = process.argv.slice(3)
  const allowRemote = argv.includes('--allow-remote')

  try {
    switch (command) {
      case 'setup': {
        const urlFlag = argv.indexOf('--url')
        await setup({
          seed: argv.includes('--seed') || argv.includes('-s'),
          force: argv.includes('--force') || argv.includes('-f'),
          auto: argv.includes('--auto') || argv.includes('-a'),
          allowRemote,
          provider: providerArg(argv),
          url: urlFlag !== -1 ? argv[urlFlag + 1] : null,
        })
        break
      }

      case 'switch': {
        const provider = argv[0]
        if (provider) {
          await setup({ provider, url: getUrlTemplate(provider), allowRemote })
        } else {
          await switchInteractive()
        }
        break
      }

      case 'info':
        info()
        break

      case 'auto':
        await setup({ auto: true, seed: true, force: true, allowRemote })
        break

      default:
        log(`Unknown command: ${command}`, 'error')
        log('Usage:', 'info')
        log('  node scripts/db-setup.js setup [--provider sqlite|postgresql] [--url <url>] [--seed] [--force] [--auto] [--allow-remote]', 'info')
        log('  node scripts/db-setup.js switch [sqlite|postgresql]', 'info')
        log('  node scripts/db-setup.js info', 'info')
        log('  node scripts/db-setup.js auto (auto-detect optimal config)', 'info')
        log('  --allow-remote is required to let setup touch a remote database', 'warn')
        break
    }

    rl.close()
  } catch (error) {
    log(`Error: ${error.message}`, 'error')
    rl.close()
    process.exit(1)
  }
}

main()
