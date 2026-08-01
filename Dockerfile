# Production Dockerfile for Maestria LMS
# Multi-stage build with minimal runtime image
# ============================================================
# Stage 1: base — shared Alpine with common deps
# ============================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat curl bash openssl
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# ============================================================
# Stage 2: deps — install production & dev dependencies
# ============================================================
FROM base AS deps
WORKDIR /app

# Leverage Docker cache: copy only dependency manifests first
COPY package.json package-lock.json ./
ENV HUSKY=0
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund && \
    npm rebuild lightningcss && \
    node -e "const { existsSync } = require('fs'); const path = require.resolve('lightningcss'); const bin = path.replace(/node\\/index\\.js$/, 'node/lightningcss.linux-x64-musl.node'); if (!existsSync(bin)) { console.error('Missing lightningcss native binary:', bin); process.exit(1); } console.log('lightningcss native binary ok:', bin);"

# ============================================================
# Stage 3: builder — compile the Next.js app
# ============================================================
FROM deps AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client types (needed for TypeScript compilation)
# Note: If DATABASE_URL is not available at build time (e.g., Amvera),
# prisma generate will use a fallback URL from prisma.config.ts.
# The real database connection is configured at runtime via start.sh.
RUN npx prisma generate

RUN npm run build

# Production image — no bun, no dev tools
FROM node:20-alpine AS runner
WORKDIR /app

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache wget openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Automatically leverage output traces for minimal image
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files for runtime (client + migrate engine)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Copy startup script
COPY --from=builder --chown=nextjs:nodejs /app/start.sh ./start.sh
RUN chmod +x ./start.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check — uses the app's health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Graceful shutdown handling
STOPSIGNAL SIGTERM

CMD ["sh", "./start.sh"]
