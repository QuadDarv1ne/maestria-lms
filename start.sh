#!/bin/sh
# ==========================================
# Maestria LMS — Production Startup Script
# ==========================================
set -e

echo "=========================================="
echo "[startup] Starting Maestria LMS..."
echo "=========================================="

# ── Ensure Prisma Client is generated ───────────
# This is needed when DATABASE_URL was not available during Docker build
# (e.g., on Amvera where build-time env vars differ from runtime env vars)
if [ ! -d "src/generated/prisma" ]; then
  echo "[startup] Generating Prisma Client..."
  node scripts/prisma-auto.js generate || echo "[startup] WARN: prisma generate failed — will try to use pre-built client"
fi

# ── Database Migration ──────────────────────────
# Routed through scripts/prisma-auto.js so the datasource provider is rewritten
# from the RUNTIME DATABASE_URL before Prisma runs. Calling the Prisma CLI
# directly used the provider baked into the image at build time, which produced
# "Datasource db: SQLite database ... at <host>:5432" plus a P1001 connection
# failure on PostgreSQL; migrate deploy then gave up and the server started
# against an unmigrated schema.
# Retry up to 5 times with exponential backoff
MAX_RETRIES=5
RETRY_DELAY=3
attempt=1

echo "[startup] prisma migrate deploy (attempt $attempt/$MAX_RETRIES)..."
until node scripts/prisma-auto.js migrate deploy; do
  if [ $attempt -ge $MAX_RETRIES ]; then
    echo "[startup] WARN: prisma migrate deploy failed after $MAX_RETRIES attempts — starting server on previous schema"
    break
  fi
  echo "[startup] migration attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
  attempt=$((attempt + 1))
  RETRY_DELAY=$((RETRY_DELAY * 2))
done

# ── Content sync (articles/courses/categories) ──
# Non-destructive upsert of demo content by slug on EVERY boot, so new or
# updated articles/courses from the repository reach the deployed PostgreSQL
# automatically (previously the seed ran only once on an empty database and
# later content changes never appeared on Amvera).
# NOTE: the sync must NEVER be fatal — a failure must not stop the server
# from starting (otherwise the container crash-loops on Amvera).
echo "[startup] syncing content (categories/courses/articles)..."
if node scripts/seed.js --sync; then
  echo "[startup] content sync finished (exit 0)"
else
  sync_exit=$?
  echo "[startup] WARNING: content sync failed with exit code ${sync_exit} — the app will start with whatever content is already in the database. Check the sync errors above."
fi

# ── Start Application ───────────────────────────
echo "[startup] starting Next.js (standalone) on port ${PORT:-3000}..."
exec node server.js
