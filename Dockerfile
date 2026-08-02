# Production Dockerfile for Maestria LMS
# Multi-stage build with minimal runtime image
# ============================================================
# Stage 1: base — shared Alpine with common deps
# ============================================================
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat curl bash openssl python3 make g++ && \
    ln -sf /usr/bin/python3 /usr/bin/python
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# ============================================================
# Stage 2: deps — install production dependencies only
# ============================================================
FROM base AS deps
WORKDIR /app

# Leverage Docker cache: copy only dependency manifests first
COPY package.json package-lock.json ./
ENV HUSKY=0
ENV PYTHON=/usr/bin/python3
ENV npm_config_engine_strict=false
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund --engine-strict=false

# ============================================================
# Stage 3: builder — install dev deps and compile
# ============================================================
FROM deps AS builder
WORKDIR /app

# Copy full source code (triggers dev deps install when code changes)
COPY . .

# Install dev dependencies on top of production (faster than full npm ci)
ENV HUSKY=0
ENV PYTHON=/usr/bin/python3
ENV npm_config_engine_strict=false
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=peer --no-audit --no-fund --engine-strict=false

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
FROM node:22-alpine AS runner
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
