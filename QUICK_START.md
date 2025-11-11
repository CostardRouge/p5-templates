# Quick Start Guide

## First Time Setup

```bash
# 1. Run setup script
chmod +x setup.sh
./setup.sh

# 2. Start development
npm run dev
```

Visit http://localhost:3000

## Daily Development

### Option A: Native (Recommended for M1/M2 Macs)

```bash
# Start infrastructure only
docker-compose up -d redis minio postgres

# Run app natively
npm run dev
```

### Option B: Full Docker

```bash
# Everything in Docker
make app-dev
```

## Common Tasks

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f redis
docker-compose logs -f minio
docker-compose logs -f postgres
```

### Database Operations
```bash
# Create migration
npx prisma migrate dev --name your_migration_name

# Apply migrations
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio

# Regenerate client (after schema changes)
npx prisma generate
```

### Stop Everything
```bash
# Stop services
docker-compose down

# Stop and remove volumes (clean slate)
make clean
```

## Troubleshooting

### "Prisma Client could not locate the Query Engine"

**Native development:**
```bash
npx prisma generate
```

**Docker development:**
```bash
make app-dev  # Automatically runs prisma generate
```

### "SignatureDoesNotMatch" for MinIO URLs

Check your `.env`:
```bash
S3_ENDPOINT=http://localhost:9000
S3_PUBLIC_ENDPOINT=http://localhost:9000
```

Restart the dev server after changing.

### Services won't start

```bash
# Check status
docker-compose ps

# Restart services
docker-compose restart

# Nuclear option: clean and restart
make clean
./setup.sh
```

### Port already in use

```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

## Service URLs

- **App**: http://localhost:3000
- **MinIO Console**: http://localhost:9001
  - Username: `minio`
  - Password: `minio123`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

## Key Files

- `.env` - Environment variables (create from `.env.example`)
- `docker-compose.yml` - Service definitions
- `Makefile` - Development commands
- `prisma/schema.prisma` - Database schema

## Getting Help

```bash
# Show all make commands
make help

# Check service health
docker-compose ps

# View service logs
docker-compose logs -f [service-name]
```
