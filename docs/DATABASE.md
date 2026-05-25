# 🗄️ Database Configuration Guide

Maestria LMS supports **3 database engines** with automatic optimal configuration detection.

## Supported Databases

| Database | Provider | Best For | Prisma Support |
|----------|----------|----------|----------------|
| 🗄️ SQLite | `sqlite` | Development, quick start | ✅ Full |
| 🐘 PostgreSQL | `postgresql` | Production, complex queries | ✅ Full |
| 🍃 MongoDB | `mongodb` | NoSQL, flexible schema | ⚠️ Native driver |

## Quick Start

### Automatic Detection (Recommended)

```bash
# Automatically detects best database for your environment
bun run dev:v2
```

### Force Specific Database

```bash
# SQLite (zero-config, file-based)
bun run dev:sqlite

# PostgreSQL (requires Docker or local install)
bun run dev:pg

# MongoDB (requires Docker or local install)
bun run dev:mongo
```

## Auto-Detection Logic

The setup script automatically selects the optimal database:

1. **Docker available** → PostgreSQL (production parity)
2. **PostgreSQL installed** → PostgreSQL
3. **MongoDB installed** → MongoDB
4. **Windows without Docker** → SQLite
5. **Default fallback** → SQLite

## Manual Configuration

### SQLite (Default)

```env
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./prisma/data.db
```

No additional setup required.

### PostgreSQL

#### Option A: Docker (Recommended)

```bash
# Start PostgreSQL container
bun run docker:db

# Or manually:
docker compose -f docker-compose.db.yml up -d postgres
```

```env
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://postgres:password@localhost:5432/maestria_lms?schema=public
```

#### Option B: Local Installation

Install PostgreSQL locally, then:

```bash
# Create database
createdb maestria_lms

# Set environment variables
```

### MongoDB

#### Option A: Docker

```bash
docker compose -f docker-compose.db.yml up -d mongodb
```

#### Option B: Local Installation

```bash
# macOS with Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Ubuntu
sudo systemctl start mongod
```

```env
DATABASE_PROVIDER=mongodb
DATABASE_URL=mongodb://localhost:27017/maestria_lms
```

## Port Configuration

All ports are auto-detected to avoid conflicts:

| Service | Default | Auto-detect Range |
|---------|---------|-------------------|
| Next.js App | 3000 | 3000-3020 |
| PostgreSQL | 5432 | 5432-5452 |
| MongoDB | 27017 | 27017-27037 |

If a port is occupied, the next available one is used automatically.

## Switching Databases

### Interactive Mode

```bash
bun run db:switch
```

### Command Line

```bash
# Switch to PostgreSQL
node scripts/db-setup.js switch postgresql

# Switch to MongoDB
node scripts/db-setup.js switch mongodb

# Switch to SQLite
node scripts/db-setup.js switch sqlite
```

## Database Scripts

| Script | Description |
|--------|-------------|
| `bun run db:info` | Show current database configuration |
| `bun run db:auto` | Auto-detect and setup optimal database |
| `bun run db:switch` | Interactive database switcher |
| `bun run db:studio` | Open Prisma Studio (SQLite/PostgreSQL) |
| `bun run db:push` | Push schema to database |
| `bun run db:generate` | Generate Prisma client |

## Docker Compose Services

```bash
# Start all databases
bun run docker:db

# Start with management tools
# (MongoDB Express at http://localhost:8081)
docker compose -f docker-compose.db.yml --profile tools up -d

# Stop all services
bun run docker:db:stop

# View logs
bun run docker:db:logs
```

## MongoDB with Prisma

MongoDB uses the native driver (`src/lib/mongodb.ts`) instead of Prisma due to limited Prisma MongoDB support.

Collections are created automatically with indexes on first connection.

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Or let the auto-detector handle it
bun run dev:v2
```

### PostgreSQL Connection Failed

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Start Docker container
bun run docker:db
```

### MongoDB Connection Failed

```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Start Docker container
docker compose -f docker-compose.db.yml up -d mongodb
```

### Reset Database

```bash
# SQLite — just delete the file
rm prisma/data.db

# PostgreSQL
docker compose -f docker-compose.db.yml down -v
bun run docker:db

# MongoDB
docker compose -f docker-compose.db.yml down -v
bun run docker:db
```
