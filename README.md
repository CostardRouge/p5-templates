

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

## Checks

What CI runs (Node 24, four parallel jobs), and what to run before opening a pull request:

```bash
npm run check               # lint + typecheck + test
npm run build               # compiles every sketch route — catches broken imports the tests cannot
```

`npm run lint:fix` is the formatter (ESLint `@stylistic`; there is no Prettier). A new or renamed sketch needs `npm run sketch:meta:write` to regenerate the catalogue; the pre-commit hook does it for you when a sketch is staged.

## Driving it from Claude (MCP)

`scripts/mcp/sketchbook-mcp.ts` is an MCP server over stdio: Claude (or any MCP client) can list the sketches, read their parameters, **render a frame and look at it**, queue a video and fetch the MP4. It drives a running Sketchbook over its public routes and renders single frames itself in headless Chromium, so start the app first (`npm run dev`, or point it at a deployment). Node ≥ 22.18 runs it straight from TypeScript.

```bash
claude mcp add sketchbook -- node "$PWD/scripts/mcp/sketchbook-mcp.ts"

# against another server, with frames and videos written somewhere you choose
claude mcp add \
  --env SKETCHBOOK_URL=https://p5.steeve.website \
  --env SKETCHBOOK_OUTPUT_DIR="$HOME/Movies/sketchbook" \
  sketchbook -- node "$PWD/scripts/mcp/sketchbook-mcp.ts"
```

Three tools, the same three as Atelier's: `sketchbook_status`, `sketchbook_commands` (every command with its JSON Schema and whether it can run now) and `sketchbook_run` (`{ command, params }`). The commands: `app.status`, `sketches.list`, `sketches.describe`, `render.frame`, `render.video`, `jobs.get`, `jobs.wait`, `jobs.result`. A parameter outside its control's range is refused, never clamped. Videos need the recording infra (`docker-compose up -d redis minio postgres`); frames do not. `PW_CHROMIUM` points it at a Chromium binary when Playwright's own is not installed. Decisions and traps: `docs/memory/agent-commands.md`.

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
├── app/              # Next.js pages, API routes, server actions
├── components/       # React components (the studio lives in ClientProcessingSketch/)
├── engines/          # The SketchEngine contract and the p5 / GSAP / Three.js engines
├── sketches/         # The sketches themselves, per engine (p5/, gsap/, threejs/) + metadata.json
├── generated/        # Generated sketch registries and Prisma client — never hand-edit
├── lib/              # Core logic: recording, export, assets, progression, connections
├── services/         # BullMQ queue/worker and web-push
├── hooks/ utils/ types/
prisma/               # DB schema & migrations
public/assets/        # Fonts, images, libraries
scripts/              # Build & dev scripts (sketch catalogue, bench, VAPID keys); mcp/ is the MCP server
docs/memory/          # Maintained project memory: decisions, traps, conventions
```

Security note: no route is authenticated. Anything with `BACKEND_RECORDING=true` exposes the recording API to whoever can reach the host — see `docs/memory/security.md` before deploying it publicly.

## License

Private project
