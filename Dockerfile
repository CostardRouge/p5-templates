FROM mcr.microsoft.com/playwright:v1.50.1-jammy

WORKDIR /app

# 0. Install FFmpeg for video encoding
RUN apt-get update \
 && apt-get install -y ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# 1. Copy package files + Prisma schema so postinstall’s `prisma generate` works
# 1.1. source code
COPY src ./src
COPY public ./public
COPY prisma ./prisma

# 1.2. bundler config
COPY next.config.ts ./next.config.ts
COPY tsconfig.json ./tsconfig.json
COPY tailwind.config.ts ./tailwind.config.ts
COPY postcss.config.mjs ./postcss.config.mjs

# 1.3. deps config
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json

# 2. Install dependencies (runs postinstall → prisma generate)
RUN npm ci

# 3. Build the nextjs project
ENV NODE_ENV=production
ENV REDIS_URL=redis://redis:6379

# ─── Postgres ──────────────────────────────────────────────────────────────
ENV POSTGRES_DB=social-pipeline
ENV POSTGRES_USER=social-pipeline-user
ENV POSTGRES_PASSWORD=social-pipeline-pass

# ─── Database (Prisma) ─────────────────────────────────────────────────────
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

RUN npm run build

# 4. Migrate/Create the database
RUN npx prisma migrate deploy

# 5. Expose port for the app
EXPOSE 3000

# 6. Default command
CMD ["npm", "run", "start"]