

# Sketchbook

A Next.js app for building and exporting visuals from creative-coding sketches. Sketches run on multiple engines (p5.js, GSAP, Three.js); configure them through a UI, then render and export them as images or videos — either in-browser or via a headless Playwright backend.

## Stack

- **Next.js 16** (App Router) · **TypeScript** · **Tailwind CSS**
- **p5.js**, **GSAP**, and **Three.js** rendering engines
- **Prisma + PostgreSQL** for persistence
- **BullMQ + Redis** for background job processing
- **MinIO** for S3-compatible video/image storage
- **Playwright** for headless recording

## Getting Started

Run the setup script to install dependencies and spin up infrastructure:

```bash
chmod +x setup.sh && ./setup.sh
```

This creates `.env` from `.env.example`, starts Docker services (Redis, MinIO, PostgreSQL), installs npm packages, and runs DB migrations.

### Development

**Native (recommended for Apple Silicon):**
```bash
docker-compose up -d redis minio postgres
npm run dev
```

**Full Docker:**
```bash
make app-dev
```

App runs at `http://localhost:3000`.

### Production

```bash
make app-prod
```

## Services

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| MinIO Console | http://localhost:9001 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Key Environment Variables

See `.env.example` for the full list. The main ones:

```bash
APP_PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_PUBLIC_ENDPOINT=http://localhost:9000   # must be browser-accessible
S3_BUCKET=recordings
BACKEND_RECORDING=true
```

> **Docker note:** `NEXT_PUBLIC_*` variables are baked in at build time. Set `BACKEND_RECORDING`, `NOTIFICATIONS`, `LIVE_THUMBNAIL`, and `NEXT_PUBLIC_*` vars as build args in CI/CD, not just runtime env vars.

### Feature flags

Optional features, each gated by an env var (mapped to a `NEXT_PUBLIC_*` build
flag in `next.config.ts`). All default **off** — set the var to `true` to enable.

| Var | Enables |
|---|---|
| `PREVIEW_ON_HOVER` | Animated template previews on hover |
| `LIVE_THUMBNAIL` | Live thumbnail mirroring of the main canvas |
| `NOTIFICATIONS` | Push notifications |
| `INTERACTION_BINDINGS` | **Interaction bindings plugin** — the per-field modulation pastilles + the Interaction settings panel on every sketch (webcam, mic, orbit, perlin noise, gyroscope…). Off by default because it boots interaction handlers and samples channels every frame; turn it on to bind parameters to live inputs. |

```bash
INTERACTION_BINDINGS=true   # in .env / .env.local, then restart the dev server
```

## Useful Commands

```bash
make help                   # list all make targets
npx prisma migrate dev      # create & apply a migration
npx prisma studio           # open Prisma Studio
make dc-down                # stop all Docker services
make clean                  # stop services and remove volumes
```

## Project Structure

```
src/
├── app/              # Next.js pages & API routes
├── components/       # React components
├── lib/              # Core business logic
├── templates/        # The sketches themselves (p5/gsap/threejs) + shared utils
└── utils/            # Utility helpers
prisma/               # DB schema & migrations
public/assets/        # Fonts, images, libraries
scripts/              # Build & dev scripts
```

## License

Private project
