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

#### Development
- `npm run dev` - Start development server (native)
- `make app-dev` - Start development server (Docker)

#### Docker Services
- `make dc-up` - Start all services
- `make dc-down` - Stop all services
- `make dc-build` - Build Docker images
- `make redis` - Start only Redis
- `make minio` - Start only MinIO
- `make postgres` - Start only PostgreSQL

#### Database
- `npx prisma migrate dev` - Create and apply migrations
- `npx prisma migrate deploy` - Apply migrations (production)
- `npx prisma studio` - Open Prisma Studio
- `npx prisma generate` - Generate Prisma client

#### Application
- `make app-bash` - Open shell in app container
- `make app-build` - Build app in Docker
- `make app-start` - Start production server in Docker

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
