/**
 * Database setup script for multi-database support
 * Usage: node scripts/setup-db.js [postgresql|mysql|sqlite] [--seed]
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const provider = process.argv[2] || 'postgresql'
const shouldSeed = process.argv.includes('--seed')
const envFile = path.join(__dirname, '..', '.env.local')
const prismaDir = path.join(__dirname, '..', 'prisma')

function log(message) {
  console.log(`[setup-db] ${message}`)
}

function run(command) {
  log(`Running: ${command}`)
  execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
}

function generateDatabaseUrl(provider) {
  switch (provider) {
    case 'sqlite':
      return 'file:./prisma/data.db'
    case 'postgresql':
      return 'postgresql://postgres:password@localhost:5432/maestria_lms?schema=public'
    case 'mysql':
      return 'mysql://root:password@localhost:3306/maestria_lms'
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

function switchSchema(provider) {
  const schemaFile = path.join(prismaDir, 'schema.prisma')

  if (provider === 'postgresql') {
    // Main schema is PostgreSQL by default
    // Read the current schema and ensure it's set to postgresql
    log('Switching to PostgreSQL schema...')
    const mainSchema = fs.readFileSync(schemaFile, 'utf8')
    const postgresqlDatasource = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`
    const updatedSchema = mainSchema.replace(/datasource db \{[\s\S]*?\}/, postgresqlDatasource)
    fs.writeFileSync(schemaFile, updatedSchema)
    log('Updated schema.prisma to use postgresql')
    return
  }

  const sourceFile = path.join(prismaDir, `schema.${provider}.prisma`)

  if (fs.existsSync(sourceFile)) {
    log(`Switching to ${provider} schema...`)

    // Read the provider-specific schema
    const providerSchema = fs.readFileSync(sourceFile, 'utf8')

    // Read the main schema
    const mainSchema = fs.readFileSync(schemaFile, 'utf8')

    // Replace only the datasource block
    const datasourceMatch = mainSchema.match(/datasource db \{[\s\S]*?\}/)
    const providerDatasource = providerSchema.match(/datasource db \{[\s\S]*?\}/)

    if (datasourceMatch && providerDatasource) {
      const updatedSchema = mainSchema.replace(datasourceMatch[0], providerDatasource[0])
      fs.writeFileSync(schemaFile, updatedSchema)
      log(`Updated schema.prisma to use ${provider}`)
    } else {
      throw new Error('Could not find datasource blocks in schema files')
    }
  } else {
    throw new Error(`Schema file not found: ${sourceFile}`)
  }
}

async function setup() {
  log(`Setting up database for: ${provider}`)

  if (!['postgresql', 'mysql', 'sqlite'].includes(provider)) {
    log(`Error: Invalid provider. Must be one of: postgresql, mysql, sqlite`)
    process.exit(1)
  }

  // Switch schema if needed
  switchSchema(provider)

  // Update .env.local
  let envContent = ''
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf8')

    // Replace existing DATABASE_PROVIDER and DATABASE_URL
    envContent = envContent.replace(
      /^DATABASE_PROVIDER=.*$/m,
      `DATABASE_PROVIDER=${provider}`
    )
    envContent = envContent.replace(
      /^DATABASE_URL=.*$/m,
      `DATABASE_URL=${generateDatabaseUrl(provider)}`
    )

    // Add if not present
    if (!envContent.includes('DATABASE_PROVIDER=')) {
      envContent = `DATABASE_PROVIDER=${provider}\n${envContent}`
    }
    if (!envContent.includes('DATABASE_URL=')) {
      envContent = `DATABASE_URL=${generateDatabaseUrl(provider)}\n${envContent}`
    }
  } else {
    envContent = `DATABASE_PROVIDER=${provider}\nDATABASE_URL=${generateDatabaseUrl(provider)}\n`
  }

  fs.writeFileSync(envFile, envContent)
  log(`Updated .env.local with ${provider} configuration`)

  // Generate Prisma client
  log('Generating Prisma client...')
  run('npx prisma generate')

  // Push schema to database
  log('Pushing schema to database...')
  run('npx prisma db push')

  // Seed data (optional)
  if (shouldSeed) {
    log('Seeding database...')
    run('npx prisma db seed')
  }

  log(``)
  log(`Database setup complete for ${provider}!`)
  log(``)
  log(`To start the development server:`)
  log(`  npm run dev`)
  log(``)
  log(`To open Prisma Studio (database GUI):`)
  log(`  npm run db:studio`)
}

setup().catch((error) => {
  log(`Error: ${error.message}`)
  process.exit(1)
})
