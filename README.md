# Social Templates Renderer

A Next.js application for rendering and recording P5.js sketches with video export capabilities.

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose
- macOS, Linux, or Windows with WSL2

### Installation

Run the setup script to install dependencies and start infrastructure services:

```bash
chmod +x setup.sh
./setup.sh
```

This will:
- Create `.env` from `.env.example` if it doesn't exist
- Start Redis, MinIO, and PostgreSQL with Docker
- Install npm dependencies
- Generate Prisma client
- Run database migrations

### Development

#### Option 1: Native Development (Recommended for M1/M2 Macs)

Start infrastructure services with Docker, run the app natively:

```bash
# Start infrastructure services
docker-compose up -d redis minio postgres

# Start development server
npm run dev
```

The app will be available at http://localhost:3000

#### Option 2: Full Docker Development

Run everything in Docker (automatically generates Prisma client for Linux):

```bash
make app-dev
```

### Available Commands

Run `make help` to see all available commands.

#### Development
- `npm run dev` - Start development server (native, recommended)
- `make app-dev` - Start development server in Docker with hot reload
- `make services-up` - Start only infrastructure services
- `make app-bash-dev` - Open bash in dev container with mounted code

#### Production
- `make app-prod` - Rebuild and start production server
- `make dc-build` - Build Docker images
- `make dc-rebuild` - Rebuild without cache
- `make dc-up` - Start all services

#### Docker Services
- `make redis` - Start only Redis
- `make minio` - Start only MinIO
- `make postgres` - Start only PostgreSQL
- `make dc-down` - Stop all services
- `make clean` - Stop services and remove volumes

#### Database
- `npx prisma migrate dev` - Create and apply migrations
- `npx prisma migrate deploy` - Apply migrations (production)
- `npx prisma studio` - Open Prisma Studio
- `npx prisma generate` - Generate Prisma client

## Service URLs

- **App**: http://localhost:3000
- **MinIO Console**: http://localhost:9001 (user: `minio`, pass: `minio123`)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Environment Variables

Key environment variables (see `.env.example` for full list):

```bash
# App
APP_PORT=3000
BACKEND_RECORDING=true
USE_STREAMING_MODE=true

# S3/MinIO
S3_ENDPOINT=http://localhost:9000          # Internal endpoint
S3_PUBLIC_ENDPOINT=http://localhost:9000   # Public endpoint for browser
S3_BUCKET=recordings
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123

# Database
DATABASE_URL=postgresql://social-pipeline-user:social-pipeline-pass@localhost:5432/social-pipeline

# Redis
REDIS_URL=redis://localhost:6379
```

### Important: Build-Time vs Runtime Variables (Docker/CI)

When using Docker, values used by `NEXT_PUBLIC_*` variables are baked into the frontend bundle during `npm run build`.

- Set these at build time in CI/CD (GitHub Actions `build-args`) and in Portainer stack build args:
	- `BACKEND_RECORDING`
	- `NOTIFICATIONS`
	- `LIVE_THUMBNAIL`
	- `NEXT_PUBLIC_GITHUB_REPO_URL`
	- `NEXT_PUBLIC_SITE_URL`
	- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- Also keep runtime env values in the container for server-side logic:
	- `BACKEND_RECORDING`, `NOTIFICATIONS`, `LIVE_THUMBNAIL`
	- `DATABASE_URL`, `REDIS_URL`
	- `S3_*` variables
	- `VAPID_PRIVATE_KEY`

If build-time values are missing, UI elements controlled by public flags (for example menu links and feature toggles) may disappear even if runtime env values are correct.

### Important: S3 Endpoint Configuration

- `S3_ENDPOINT`: Used by the server for internal S3 operations
- `S3_PUBLIC_ENDPOINT`: Used for generating signed URLs accessible from the browser
- When running with Docker Compose, the app container uses `http://minio:9000` internally
- For native development, both should be `http://localhost:9000`

## Architecture

- **Next.js 15**: React framework with App Router
- **Prisma**: Database ORM with PostgreSQL
- **BullMQ**: Job queue for background video processing
- **Playwright**: Headless browser for recording
- **MinIO**: S3-compatible object storage
- **Redis**: Queue and caching

## Development vs Production

### Development Mode

**Native (Recommended for M1/M2 Macs):**
```bash
# Start infrastructure
docker-compose up -d redis minio postgres

# Run app natively
npm run dev
```
- Uses your local Node.js and npm
- Hot reload works instantly
- Prisma client matches your machine architecture
- Faster iteration

**Docker:**
```bash
make app-dev
```
- Mounts your local code into the container
- Automatically generates Prisma client for Linux
- Hot reload works (may be slightly slower)
- Consistent environment across team

### Production Mode

```bash
make app-prod
```
- Rebuilds Docker image with latest code
- Runs optimized production build
- No code mounting, everything is in the image
- Use this to test production builds

**Important:** `make app-dev` mounts your local code, so changes are reflected immediately. `make dc-up` runs the production image built with `make dc-build`, which contains a snapshot of your code at build time.

## Troubleshooting

### Prisma Client Platform Mismatch

If you see "Prisma Client could not locate the Query Engine for runtime" errors:

**For native development:**
```bash
npx prisma generate
```

**For Docker development:**
The Makefile automatically runs `npx prisma generate` before starting the dev server.

### MinIO Signature Errors

If you see "SignatureDoesNotMatch" errors when accessing thumbnails:

1. Ensure `S3_PUBLIC_ENDPOINT` is set correctly in `.env`
2. Restart the development server
3. The signed URLs must use the same endpoint that the browser can access

### Services Not Starting

Check service health:
```bash
docker-compose ps
```

View logs:
```bash
docker-compose logs -f
```

Restart services:
```bash
docker-compose restart
```

## Project Structure

```
.
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/              # Core business logic
│   ├── p5-sketches/      # P5.js sketch templates
│   └── utils/            # Utility functions
├── prisma/
│   └── schema.prisma     # Database schema
├── public/               # Static assets
├── scripts/              # Build and utility scripts
├── docker-compose.yml    # Docker services configuration
├── Dockerfile            # App container definition
└── Makefile              # Development commands
```

## License

Private project
