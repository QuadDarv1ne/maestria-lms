# Database Setup Guide

This project supports multiple databases through Prisma ORM: **PostgreSQL**, **MySQL**, and **SQLite**.

## Quick Start

### SQLite (Default - Development)

Perfect for local development and testing:

```bash
npm run db:setup:sqlite
```

### PostgreSQL (Recommended for Production)

1. Start PostgreSQL server (e.g., via Docker):
   ```bash
   docker-compose -f docker-compose.db.yml up -d postgres
   ```

2. Setup the database:
   ```bash
   npm run db:setup:pg
   ```

### MySQL (Alternative Production Option)

1. Start MySQL server (e.g., via Docker):
   ```bash
   docker-compose -f docker-compose.db.yml up -d mysql
   ```

2. Setup the database:
   ```bash
   npm run db:setup:mysql
   ```

## Automatic Provider Detection

The system **automatically detects** the database provider from `DATABASE_URL`:

- `file:./path.db` → SQLite
- `postgresql://...` or `postgres://...` → PostgreSQL
- `mysql://...` or `mariadb://...` → MySQL

No need to manually set `DATABASE_PROVIDER` - just set the correct `DATABASE_URL`!

## Configuration

### Environment Variables

Edit `.env` to configure your database:

```env
# SQLite (development)
DATABASE_URL="file:./prisma/data.db"

# PostgreSQL (production)
DATABASE_URL="postgresql://user:password@localhost:5432/database?schema=public"

# MySQL (alternative)
DATABASE_URL="mysql://user:password@localhost:3306/database"
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run db:setup:sqlite` | Setup SQLite database (with reset & seed) |
| `npm run db:setup:pg` | Setup PostgreSQL database (with reset & seed) |
| `npm run db:setup:mysql` | Setup MySQL database (with reset & seed) |
| `npm run db:push` | Sync schema without migrations (auto-detects provider) |
| `npm run db:generate` | Generate Prisma client (auto-detects provider) |
| `npm run db:migrate` | Run migrations (dev mode) |
| `npm run db:reset` | Reset database and rerun migrations |
| `npm run db:studio` | Open Prisma Studio (GUI) |
| `npm run db:switch` | Interactive database switcher |
| `npm run db:info` | Show current database configuration |

## Database Comparison

| Feature | SQLite | PostgreSQL | MySQL |
|---------|--------|------------|-------|
| **Use Case** | Development/Testing | Production | Production |
| **Performance** | Good for small datasets | Excellent | Excellent |
| **Concurrent Writes** | Limited | Unlimited | High |
| **Full-text Search** | Basic | Advanced | Good |
| **JSON Support** | Basic | Excellent | Good |
| **Deployment** | Single file | Server required | Server required |

## Using Different Databases

### Switch Between Databases

**Interactive mode:**
```bash
npm run db:switch
```

**Direct switch:**
```bash
node scripts/db-setup.js switch sqlite
node scripts/db-setup.js switch postgresql
node scripts/db-setup.js switch mysql
```

### Manual Setup

```bash
# Setup with specific provider
node scripts/db-setup.js setup --provider sqlite --seed

# Reset and reseed
node scripts/db-setup.js setup --provider postgresql --force --seed

# Just sync schema (no reset)
node scripts/db-setup.js setup --provider mysql
```

## Production Deployment

### PostgreSQL (Vercel/Supabase/Railway)

1. Create a PostgreSQL database on your provider
2. Set environment variable:
   ```env
   DATABASE_URL=your_production_connection_string
   ```

3. Deploy and run migrations:
   ```bash
   npm run db:push
   ```

### Docker Deployment

```bash
# Start PostgreSQL
docker-compose -f docker-compose.db.yml up -d postgres

# Setup database
npm run db:setup:pg

# Run application
npm run dev
```

## Troubleshooting

### "Invalid DATABASE_URL" Error

- **PostgreSQL**: `postgresql://user:password@host:5432/database?schema=public`
- **MySQL**: `mysql://user:password@host:3306/database`
- **SQLite**: `file:./path/to/database.db`

### Database Server Not Running

```bash
# Start database with Docker
docker-compose -f docker-compose.db.yml up -d postgres
# or
docker-compose -f docker-compose.db.yml up -d mysql
```

### Schema Sync Issues

```bash
# Reset and rebuild
npm run db:setup:sqlite  # or pg, mysql
```

### Connection Pool Exhausted (Production)

Add connection parameters to your DATABASE_URL:
```
postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=30
```

## Development Tips

### Prisma Studio

Visual database browser:
```bash
npm run db:studio
```

### Check Current Configuration

```bash
npm run db:info
```

### Query Logging

Enabled automatically in development mode via `src/lib/db.ts`.

### Type Safety

Always use generated types:
```typescript
import { User, Course, Prisma } from '@prisma/client'
import { db } from '@/lib/db'

const user: User = await db.user.findUnique({ where: { id } })
```

## Scripts Architecture

- **`scripts/db-setup.js`** - Main setup script with automatic provider detection
- **`scripts/prisma-auto.js`** - Prisma wrapper that auto-detects provider from URL
- **`prisma/schema.sqlite.prisma`** - SQLite-specific schema template
- **`prisma/schema.mysql.prisma`** - MySQL-specific schema template
- **`docker-compose.db.yml`** - Docker configurations for PostgreSQL/MySQL
