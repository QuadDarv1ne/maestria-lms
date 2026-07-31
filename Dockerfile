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

# Install bun for dependency management
RUN curl -fsSL https://bun.sh/install | bash -s -- bun-v1.3.14
ENV PATH="/root/.bun/bin:$PATH"

# Leverage Docker cache: copy only dependency manifests first
COPY package.json bun.lock ./
ENV HUSKY=0
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ============================================================
# Stage 3: builder — compile the Next.js app
# ============================================================
FROM deps AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client types (needed for TypeScript compilation)
RUN npx prisma generate

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN bun run build

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

# Copy CSP-aware server wrapper (handles Amvera's CSP header injection)
COPY --from=builder --chown=nextjs:nodejs /app/server-with-csp.js ./server-with-csp.js
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
