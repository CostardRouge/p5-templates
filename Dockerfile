# syntax=docker/dockerfile:1

# ─── Stage 1: build ──────────────────────────────────────────────────────────
# Full toolchain (dev deps included) to compile the Next.js standalone bundle.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS builder

WORKDIR /app

# Build-time flags used by Next.js when generating client bundles.
ARG BACKEND_RECORDING=false
ARG NOTIFICATIONS=false
ARG LIVE_THUMBNAIL=false
ARG NEXT_PUBLIC_GITHUB_REPO_URL=
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=

ENV BACKEND_RECORDING=${BACKEND_RECORDING}
ENV NOTIFICATIONS=${NOTIFICATIONS}
ENV LIVE_THUMBNAIL=${LIVE_THUMBNAIL}
ENV NEXT_PUBLIC_GITHUB_REPO_URL=${NEXT_PUBLIC_GITHUB_REPO_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}

# Copy dependency files first for better layer caching.
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install dependencies (runs postinstall → prisma generate).
RUN npm ci

# Copy configuration files.
COPY next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs ./

# Copy application code.
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Build the Next.js project (emits .next/standalone + .next/static).
ENV NODE_ENV=production
RUN npm run build

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
# Slim runtime: Playwright base (browsers + Node already present) + ffmpeg.
# Only the standalone server, static assets, public files and the Prisma CLI
# (needed for `migrate deploy` on startup) are copied over — no dev deps.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS runner

WORKDIR /app

ENV NODE_ENV=production
# Standalone server honours these; bind to all interfaces inside the container.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Runtime system dependencies.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Application: standalone server, static chunks and public assets.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma: schema + migrations for `migrate deploy`, the generated client (with
# its native query engine) and the CLI used by the entrypoint at startup.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Entrypoint: runs migrations then starts the standalone server.
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
