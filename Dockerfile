# Production Dockerfile for Maestria LMS
# Multi-stage build with minimal runtime image

FROM node:20-alpine AS base

# Install bun
RUN apk add --no-cache libc6-compat unzip && \
    curl -fsSL https://bun.sh/install | bash -s -- bun-v1.3.11
ENV PATH="/root/.bun/bin:$PATH"

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
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

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Automatically leverage output traces for minimal image
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files for runtime (client + migrate engine)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

COPY --from=builder --chown=nextjs:nodejs /app/start.sh ./start.sh
RUN chmod +x ./start.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Graceful shutdown handling
STOPSIGNAL SIGTERM

CMD ["sh", "./start.sh"]
