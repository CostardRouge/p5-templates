# syntax=docker/dockerfile:1

# ─── Stage 1: build ──────────────────────────────────────────────────────────
# Full toolchain (dev deps included) to compile the Next.js standalone bundle.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS builder

WORKDIR /app

# Build-time flags used by Next.js when generating client bundles.
ARG BACKEND_RECORDING=false
ARG NOTIFICATIONS=false
ARG LIVE_THUMBNAIL=false
ARG INTERACTION_BINDINGS=false
ARG NEXT_PUBLIC_GITHUB_REPO_URL=
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
# Umami analytics. Unlike the vars above these are NOT empty-defaulted: an
# empty website id is the documented kill switch, so an empty default would
# silently ship every image with analytics off. The id mirrors the default in
# src/lib/analytics/umami.ts — keep the two in sync, or pass --build-arg to
# override (an explicitly empty id disables tracking).
ARG NEXT_PUBLIC_UMAMI_SRC=https://insight.steeve.website/insight
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID=3c44d1c6-1c3e-4ef7-aeb8-646012e9b963
ARG NEXT_PUBLIC_UMAMI_DOMAINS=p5.steeve.website

ENV BACKEND_RECORDING=${BACKEND_RECORDING}
ENV NOTIFICATIONS=${NOTIFICATIONS}
ENV LIVE_THUMBNAIL=${LIVE_THUMBNAIL}
ENV INTERACTION_BINDINGS=${INTERACTION_BINDINGS}
ENV NEXT_PUBLIC_GITHUB_REPO_URL=${NEXT_PUBLIC_GITHUB_REPO_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}
ENV NEXT_PUBLIC_UMAMI_SRC=${NEXT_PUBLIC_UMAMI_SRC}
ENV NEXT_PUBLIC_UMAMI_WEBSITE_ID=${NEXT_PUBLIC_UMAMI_WEBSITE_ID}
ENV NEXT_PUBLIC_UMAMI_DOMAINS=${NEXT_PUBLIC_UMAMI_DOMAINS}

# Copy dependency files first for better layer caching.
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Prisma 7 reads the datasource URL from prisma.config.ts (no longer from the
# schema), and the CLI loads it for `prisma generate` (postinstall) below.
COPY prisma.config.ts ./

# Strip the dev-only `prepare` script (husky hooks + git merge-driver setup): it
# needs a .git work tree and scripts/ that aren't in the build context, and has
# no purpose in an image. postinstall (prisma generate) and dependency lifecycle
# scripts still run.
RUN npm pkg delete scripts.prepare \
 && npm ci

# Copy configuration files.
COPY next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs ./

# Copy application code.
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Build the Next.js project (emits .next/standalone + .next/static).
ENV NODE_ENV=production
RUN npm run build

# ─── Stage 2: prisma CLI ─────────────────────────────────────────────────────
# A clean, isolated install of the Prisma CLI pinned to the lockfile version,
# with its FULL dependency closure (@prisma/*, effect, c12, deepmerge-ts, …).
# The runtime runs `migrate deploy` on startup; cherry-picking node_modules
# subtrees misses transitive deps, so install the CLI properly instead.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS prisma-deps

WORKDIR /prisma-cli

COPY package-lock.json ./lock.json
RUN PRISMA_VERSION="$(node -p "require('./lock.json').packages['node_modules/prisma'].version")" \
 && rm -f lock.json \
 && npm init -y >/dev/null 2>&1 \
 && npm install "prisma@${PRISMA_VERSION}" \
 && npm cache clean --force

# ─── Stage 3: runtime ────────────────────────────────────────────────────────
# Slim runtime: Playwright base (browsers + Node already present) + ffmpeg.
# Only the standalone server, static assets, public files and an isolated Prisma
# CLI (for `migrate deploy` on startup) are copied over — no dev deps.
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

# Prisma schema + migrations (read by `migrate deploy`) and the generated
# Rust-free client (the app server queries through the @prisma/adapter-pg driver
# adapter bundled into the standalone output). prisma.config.ts carries the
# datasource URL that both `migrate deploy` and the client rely on in Prisma 7.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# The isolated Prisma CLI + its full dependency closure, kept out of the app's
# own node_modules to avoid version clashes. Invoked from here by the entrypoint.
COPY --from=prisma-deps /prisma-cli/node_modules ./prisma-cli/node_modules

# Entrypoint: runs migrations then starts the standalone server.
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
