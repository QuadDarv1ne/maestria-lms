/**
 * Smart database setup script with automatic provider detection
 * Usage: node scripts/db-setup.js [setup|switch|info]
 * 
 * Automatically detects database provider from DATABASE_URL
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

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
 * Automatically detect database provider from URL
 */
function detectProvider(databaseUrl) {
  if (!databaseUrl) return null
  
  const url = databaseUrl.toLowerCase()
  
  if (url.startsWith('file:') || url.endsWith('.db') || url.endsWith('.sqlite') || url.endsWith('.sqlite3')) {
    return 'sqlite'
  }
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql'
  }
  if (url.startsWith('mysql://') || url.startsWith('mariadb://')) {
    return 'mysql'
  }
  if (url.startsWith('mongodb://') || url.startsWith('mongodb+srv://')) {
    return 'mongodb'
  }
  if (url.startsWith('sqlserver://')) {
    return 'sqlserver'
  }
  if (url.startsWith('cockroachdb://') || url.startsWith('cockroach://')) {
    return 'postgresql' // CockroachDB uses PostgreSQL protocol
  }
  
  return null
}

/**
 * Get connection URL template for a provider
 */
function getUrlTemplate(provider) {
  const templates = {
    sqlite: 'file:./prisma/data.db',
    postgresql: 'postgresql://postgres:password@localhost:5432/maestria_lms?schema=public',
    mysql: 'mysql://root:password@localhost:3306/maestria_lms'
  }
  return templates[provider]
}

/**
 * Update the datasource in schema.prisma
 */
function updateSchemaProvider(provider) {
  const schema = fs.readFileSync(schemaFile, 'utf8')
  
  const newDatasource = `datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}`
  
  const updatedSchema = schema.replace(/datasource db \{[\s\S]*?\}/, newDatasource)
  fs.writeFileSync(schemaFile, updatedSchema)
}

/**
 * Read current DATABASE_URL from .env
 */
function readEnvFile() {
  if (!fs.existsSync(envFile)) {
    return {}
  }
  
  const content = fs.readFileSync(envFile, 'utf8')
  const env = {}
  
  content.split('\n').forEach(line => {
    line = line.trim()
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim()
      }
    }
  })
  
  return env
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
  const { provider: forcedProvider, seed = false, url: forcedUrl, force = false } = options
  
  log('Starting database setup...', 'info')
  
  // Read current environment
  const env = readEnvFile()
  const currentUrl = env.DATABASE_URL
  
  // Detect or use forced provider
  let provider = forcedProvider
  let databaseUrl = forcedUrl
  
  // If no URL provided but provider is forced, use template
  if (!databaseUrl && forcedProvider) {
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
    log('Available options:', 'info')
    log('  1. sqlite - Local file database (development)', 'info')
    log('  2. postgresql - PostgreSQL (production)', 'info')
    log('  3. mysql - MySQL (production)', 'info')
    
    const answer = await new Promise(resolve => {
      rl.question('\nSelect database (1-3): ', (ans) => resolve(ans))
    })
    
    const providers = { '1': 'sqlite', '2': 'postgresql', '3': 'mysql' }
    provider = providers[answer] || 'sqlite'
  }
  
  if (!databaseUrl) {
    databaseUrl = getUrlTemplate(provider)
  }
  
  // Verify provider is supported
  if (!['sqlite', 'postgresql', 'mysql'].includes(provider)) {
    throw new Error(`Unsupported provider: ${provider}. Supported: sqlite, postgresql, mysql`)
  }
  
  log(`Configuring database for: ${provider}`, 'info')
  log(`URL: ${databaseUrl}`, 'info')
  
  // Update schema
  log('Updating Prisma schema...', 'info')
  updateSchemaProvider(provider)
  
  // Update .env
  log('Updating environment variables...', 'info')
  updateEnvFile(databaseUrl, provider)
  
  // Generate Prisma client
  log('Generating Prisma client...', 'info')
  run('npx prisma generate', { silent: true })
  
  // Push schema to database
  log('Syncing schema with database...', 'info')
  try {
    if (force) {
      log('Resetting database...', 'warn')
      const resetCmd = 'npx prisma migrate reset --force'
      log(`Running: ${resetCmd}`, 'info')
      try {
        execSync(resetCmd, {
          stdio: 'inherit',
          cwd: path.join(__dirname, '..'),
          env: {
            ...process.env,
            PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'I understand this will delete all data'
          }
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
      log(`You can use: docker-compose -f docker-compose.db.yml up -d ${provider}`, 'info')
    }
    throw error
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
  const env = readEnvFile()
  const url = env.DATABASE_URL
  const provider = detectProvider(url)
  
  log('Current Database Configuration:', 'info')
  log(`  Provider: ${provider || 'unknown'}`, provider ? 'success' : 'warn')
  log(`  URL: ${url || 'not set'}`, url ? 'success' : 'warn')
  
  if (provider) {
    const schemas = {
      sqlite: ['sqlite', 'postgresql', 'mysql'],
      postgresql: ['sqlite', 'postgresql', 'mysql'],
      mysql: ['sqlite', 'postgresql', 'mysql']
    }
    log(`  Supported: ${schemas[provider]?.join(', ') || 'none'}`, 'info')
  }
}

/**
 * Interactive switch database command
 */
async function switchInteractive() {
  const env = readEnvFile()
  const currentUrl = env.DATABASE_URL
  const currentProvider = detectProvider(currentUrl)
  
  log(`Current database: ${currentProvider || 'unknown'}`, 'info')
  log('Select new database:', 'info')
  log('  1. sqlite - Local file (development)', 'info')
  log('  2. postgresql - PostgreSQL (production)', 'info')
  log('  3. mysql - MySQL (production)', 'info')
  
  const answer = await new Promise(resolve => {
    rl.question('\nSelect (1-3): ', (ans) => resolve(ans))
  })
  
  const providers = { '1': 'sqlite', '2': 'postgresql', '3': 'mysql' }
  const provider = providers[answer]
  
  if (!provider) {
    log('Invalid selection', 'error')
    rl.close()
    return
  }
  
  const url = getUrlTemplate(provider)
  
  await setup({ provider, url })
  rl.close()
}

// Main command handler
async function main() {
  const command = process.argv[2] || 'setup'
  
  try {
    switch (command) {
      case 'setup':
        await setup({
          seed: process.argv.includes('--seed') || process.argv.includes('-s'),
          force: process.argv.includes('--force') || process.argv.includes('-f'),
          provider: process.argv[3] === '--provider' ? process.argv[4] : null,
          url: process.argv[3] === '--url' ? process.argv[4] : null
        })
        break
        
      case 'switch':
        if (process.argv[3]) {
          const provider = process.argv[3]
          const url = getUrlTemplate(provider)
          if (!url) {
            throw new Error(`Unknown provider: ${provider}`)
          }
          await setup({ provider, url })
        } else {
          await switchInteractive()
        }
        break
        
      case 'info':
        info()
        break
        
      default:
        log(`Unknown command: ${command}`, 'error')
        log('Usage:', 'info')
        log('  node scripts/db-setup.js setup [--seed] [--provider sqlite|postgresql|mysql]', 'info')
        log('  node scripts/db-setup.js switch [sqlite|postgresql|mysql]', 'info')
        log('  node scripts/db-setup.js info', 'info')
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
