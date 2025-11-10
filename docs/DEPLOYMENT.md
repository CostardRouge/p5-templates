# Deployment Guide

## Database Migrations

### Automatic Migrations (Recommended)
The Docker container automatically runs Prisma migrations on startup via the `docker-entrypoint.sh` script. This ensures your database schema is always up-to-date when deploying new versions.

### Manual Migration (If Needed)
If you need to run migrations manually on your NAS:

```bash
# SSH into your NAS and navigate to your app directory
cd /path/to/your/app

# Run migrations using docker-compose
docker-compose exec app npx prisma migrate deploy

# Or if the container isn't running yet
docker-compose run --rm app npx prisma migrate deploy
```

### Creating New Migrations (Development)
When you make changes to the Prisma schema locally:

```bash
# Create a new migration
npx prisma migrate dev --name your_migration_name

# This will:
# 1. Create a new migration file in prisma/migrations/
# 2. Apply it to your local database
# 3. Regenerate the Prisma Client
```

## CI/CD Pipeline

The deployment process:

1. **Build**: Docker image is built with all dependencies
2. **Deploy**: Image is pushed to your NAS
3. **Startup**: Container starts and automatically runs:
   - `npx prisma migrate deploy` (applies pending migrations)
   - `npm run start` (starts the Next.js app)

## Troubleshooting

### Migration Fails
If migrations fail on startup:

```bash
# Check migration status
docker-compose exec app npx prisma migrate status

# View migration history
docker-compose exec app npx prisma migrate resolve

# Reset database (⚠️ DESTRUCTIVE - only for dev)
docker-compose exec app npx prisma migrate reset
```

### Database Connection Issues
Ensure your `DATABASE_URL` environment variable is correctly set in your docker-compose.yml or .env file.
