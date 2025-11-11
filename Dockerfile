FROM mcr.microsoft.com/playwright:v1.56.1-jammy

WORKDIR /app

# Install system dependencies
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Copy dependency files first for better layer caching
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install dependencies (runs postinstall → prisma generate)
RUN npm ci && npm cache clean --force

# Copy configuration files
COPY next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs ./

# Copy application code
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Build the Next.js project
ENV NODE_ENV=production
RUN npm run build

# Copy and setup entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Run migrations and start the app
ENTRYPOINT ["/app/docker-entrypoint.sh"]
