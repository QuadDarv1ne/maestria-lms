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
  node node_modules/prisma/build/index.js generate || echo "[startup] WARN: prisma generate failed — will try to use pre-built client"
fi

# ── Database Migration ──────────────────────────
# Retry up to 5 times with exponential backoff
MAX_RETRIES=5
RETRY_DELAY=3
attempt=1

echo "[startup] prisma migrate deploy (attempt $attempt/$MAX_RETRIES)..."
until node node_modules/prisma/build/index.js migrate deploy; do
  if [ $attempt -ge $MAX_RETRIES ]; then
    echo "[startup] WARN: prisma migrate deploy failed after $MAX_RETRIES attempts — starting server on previous schema"
    break
  fi
  echo "[startup] migration attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
  attempt=$((attempt + 1))
  RETRY_DELAY=$((RETRY_DELAY * 2))
done

# ── Seed empty database ─────────────────────────
# Only seed when the database contains no courses, so a fresh deploy
# gets production content but existing data is never wiped.
# NOTE: the seed must NEVER be fatal — a seed failure must not stop the
# server from starting (otherwise the container crash-loops on Amvera).
echo "[startup] running seed (--if-empty)..."
if node scripts/seed.js --if-empty; then
  echo "[startup] seed step finished (exit 0)"
else
  seed_exit=$?
  echo "[startup] WARNING: seed script failed with exit code ${seed_exit} — the app will start with an EMPTY database (blog/courses will seem missing). Check the seed errors above."
fi

# ── Start Application ───────────────────────────
echo "[startup] starting Next.js (standalone) on port ${PORT:-3000}..."
exec node server.js
