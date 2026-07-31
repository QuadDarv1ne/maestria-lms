#!/bin/sh
# ==========================================
# Maestria LMS — Production Startup Script
# ==========================================
set -e

echo "=========================================="
echo "[startup] Starting Maestria LMS..."
echo "=========================================="

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
echo "[startup] starting Maestria LMS with CSP nonce injection on port ${PORT:-3000}..."
exec node server-with-csp.js
