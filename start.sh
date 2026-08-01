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
if [ ! -d "node_modules/.prisma/client" ]; then
  echo "[startup] Generating Prisma Client..."
  npx prisma generate || echo "[startup] WARN: prisma generate failed — will try to use pre-built client"
fi

# ── Database Migration ──────────────────────────
# Retry up to 5 times with exponential backoff
MAX_RETRIES=5
RETRY_DELAY=3
attempt=1

echo "[startup] prisma migrate deploy (attempt $attempt/$MAX_RETRIES)..."
until node node_modules/.bin/prisma migrate deploy; do
  if [ $attempt -ge $MAX_RETRIES ]; then
    echo "[startup] WARN: prisma migrate deploy failed after $MAX_RETRIES attempts — starting server on previous schema"
    break
  fi
  echo "[startup] migration attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
  attempt=$((attempt + 1))
  RETRY_DELAY=$((RETRY_DELAY * 2))
done

# ── Start Application ───────────────────────────
echo "[startup] starting Next.js (standalone) on port ${PORT:-3000}..."
exec node server.js
