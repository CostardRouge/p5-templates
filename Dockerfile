# ─── Stage 1: dependencies & build ──────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.50.1-jammy AS builder

WORKDIR /app

# 1. Copy package files + Prisma schema so postinstall’s `prisma generate` works
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma

# 2. Install dependencies (runs postinstall → prisma generate)
RUN npm ci

# 3. Copy the rest of your Prisma setup & re-generate (in case of generated client)
COPY prisma ./prisma
RUN npx prisma generate

# 4. Copy rest of source and build Next.js
COPY . .
RUN npm run build

# ─── Stage 2: runtime image ────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.50.1-jammy

WORKDIR /app

# Install FFmpeg for video encoding
RUN apt-get update \
 && apt-get install -y ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Copy production artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next        ./.next
COPY --from=builder /app/public       ./public
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Expose port for the app
EXPOSE 3000

# Default command
CMD ["npm", "run", "start"]
