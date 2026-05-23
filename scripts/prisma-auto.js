#!/usr/bin/env node
/**
 * Automatic Prisma wrapper that detects database provider from DATABASE_URL
 * and updates schema.prisma accordingly before executing Prisma commands
 * Skips Prisma commands entirely for MongoDB
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const envFile = path.join(__dirname, '..', '.env')
const schemaFile = path.join(__dirname, '..', 'prisma', 'schema.prisma')

/**
 * Detect database provider from URL
 */
function detectProvider(databaseUrl) {
  if (!databaseUrl) return null

  const url = databaseUrl.toLowerCase()

  if (url.startsWith('file:') || url.endsWith('.db') || url.endsWith('.sqlite')) {
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

  return null
}

/**
 * Read DATABASE_URL from .env
 */
function readDatabaseUrl() {
  if (!fs.existsSync(envFile)) {
    return null
  }

  const content = fs.readFileSync(envFile, 'utf8')
  const match = content.match(/^DATABASE_URL=(.+)$/m)
  return match ? match[1].trim() : null
}

/**
 * Update schema.prisma with detected provider
 */
function updateSchemaProvider(provider) {
  if (provider === 'mongodb') {
    console.log('[auto-db] MongoDB detected — skipping Prisma commands')
    return
  }

  const schema = fs.readFileSync(schemaFile, 'utf8')

  const newDatasource = `datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}`

  const updatedSchema = schema.replace(/datasource db \{[\s\S]*?\}/, newDatasource)
  fs.writeFileSync(schemaFile, updatedSchema)

  console.log(`[auto-db] Detected provider: ${provider}`)
}

// Main execution
try {
  const databaseUrl = process.env.DATABASE_URL || readDatabaseUrl()
  const provider = detectProvider(databaseUrl)

  if (provider) {
    updateSchemaProvider(provider)
  }

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
    cwd: path.join(__dirname, '..'),
    env: { ...process.env }
  })
} catch (error) {
  console.error(`[auto-db] Error: ${error.message}`)
  process.exit(error.status || 1)
}
