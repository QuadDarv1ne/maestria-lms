#!/bin/sh
echo "=========================================="
echo "[startup] prisma migrate deploy..."
echo "=========================================="
if node node_modules/.bin/prisma migrate deploy; then
  echo "[startup] OK: migrations applied"
else
  echo "[startup] WARN: prisma migrate deploy failed — starting server on previous schema"
fi

echo "[startup] starting Next.js (standalone) on port ${PORT:-3000}..."
exec node server.js
