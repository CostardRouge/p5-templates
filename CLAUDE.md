# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this project is

**Sketchbook** (`sketchbook`) is a Next.js 15 app for building,
parameterizing, and exporting visuals from creative-coding sketches.
Users pick a template, tweak its parameters through an auto-generated form, preview
it live, and export it as an image or video — either recorded in-browser or rendered
headlessly on the backend with Playwright + FFmpeg.

The rendering layer is **engine-agnostic**: p5.js is the primary engine, with a GSAP
(DOM/React) engine alongside it, both driven through a common `SketchEngine` interface.

## Tech stack

- **Next.js 15** (App Router, Turbopack) · **React 19** · **TypeScript** (strict) · **Tailwind CSS 3**
- **p5.js** and **GSAP** rendering engines
- **Prisma 7 + PostgreSQL** for persistence (client generated to `src/generated/prisma`)
- **BullMQ + Redis (ioredis)** for the background recording queue
- **MinIO / S3** (`@aws-sdk/client-s3`) for video/image/thumbnail storage
- **Playwright** (headless Chromium) + **FFmpeg** for server-side recording
- **React Hook Form + Zod** for form state and validation
- **Jest** (`ts-jest`, jsdom) + **fast-check** for tests

## Getting started

```bash
./setup.sh                              # .env, docker services, npm install, migrations
docker-compose up -d redis minio postgres   # infra only (native dev, recommended)
npm run dev                             # Next dev server (Turbopack) at :3000
```

Full-Docker dev: `make app-dev`. Production: `make app-prod`. Run `make help` for all targets.

Services: App `:3000` · MinIO console `:9001` · Postgres `:5432` · Redis `:6379`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run watch` | Dev server **plus** the sketch-metadata watcher (`scripts/dev-watch.mjs`) |
| `npm run build` | Production build (also compiles every sketch route — catches broken imports) |
| `npm run lint` / `npm run lint:fix` | ESLint (cached). `format` is an alias for `lint:fix` |
| `npm test` / `npm run test:watch` | Jest |
| `npm run check` | **`lint` + `test`** — run this before considering work done |
| `npm run sketch:meta` | Watch sketches → regenerate `metadata.json` + registries |
| `npm run sketch:meta:write` | One-shot regenerate of sketch metadata/registries |
| `npx prisma migrate dev` | Create & apply a migration · `npx prisma studio` to browse |

CI (`.github/workflows/ci.yml`) runs three parallel jobs on Node 24: **lint**, **test**, **build**.
Docs/markdown-only changes are path-ignored. Match CI locally with `npm run check` + `npm run build`.

## Repository layout

```
src/
├── app/               # Next.js App Router: pages, layouts, API routes, server actions
│   ├── api/           #   route handlers (recordings, assets, s3, previews, thumbnails, dev, health)
│   ├── actions/       #   server actions (e.g. notifications)
│   ├── templates/     #   template gallery + /templates/[engine]/[...sketch] editor pages
│   └── recordings/    #   recording dashboard page
├── engines/           # Engine abstraction (the core rendering contract)
│   ├── types.ts       #   SketchEngine + EngineRegistration interfaces — READ THIS FIRST
│   ├── registry.ts    #   getEngine/listEngines; index.ts registers p5 + gsap engines
│   ├── p5/            #   P5Engine implementation
│   ├── gsap/          #   GsapEngine implementation
│   └── recording/     #   engine-agnostic capture pipeline (recorders, encoders, strategies)
├── templates/         # The sketches themselves (NOT src/p5-sketches — README is stale here)
│   ├── p5/sketches/   #   p5 templates, grouped in category dirs, often versioned (…-v1, -v2)
│   ├── p5/utils/      #   large shared p5 toolkit (animation, colors, grid, audio, webcam, …)
│   ├── p5/shared/     #   cross-sketch helpers
│   ├── gsap/          #   gsap sketches + utils
│   └── metadata.json  #   AUTO-GENERATED sketch catalogue (do not hand-edit)
├── generated/         # AUTO-GENERATED — prisma client + sketch{Module,Options}Registry.ts
├── components/        # React UI (editor, forms, recording dashboard, ui/ primitives)
├── services/          # Recording queue/worker/notification services (BullMQ side)
├── lib/               # Core business logic (bridges, job store, recording, previews, seo)
├── hooks/             # React hooks
├── utils/             # Framework-agnostic helpers (capture, ffmpeg, zip, sketch listing)
├── config/, constants/, types/   # Config, constants, shared TS types (sketch/recording)
prisma/                # schema.prisma + migrations
scripts/               # build/dev scripts (watch-sketches, dev-watch, vapid keys, …)
docs/                  # Extensive design/feature docs (see caveats below)
public/assets/         # Fonts, images, libraries, generated thumbnails/previews
```

### Path aliases (`tsconfig.json`)

- `@/*` → `src/*`
- `@/p5/*` → `src/templates/p5/*`
- `@/gsap/*` → `src/templates/gsap/*`
- `@/public/*` → `public/*`

## How sketches work

Each sketch lives in its own directory under `src/templates/p5/sketches/` (nesting
creates categories, e.g. `churros/churros-v1-circle/`). A sketch dir contains:

- **`index.js`** — the sketch entry, using the module-based engine API (below).
- **`options.ts`** — exports `formValues` (defaults) and `formConfiguration`
  (per-field UI config: `component`, `label`, ranges, etc.) that drive the auto-generated form.

### Current p5 sketch API

Sketches import the shared `sketch` module and register lifecycle callbacks — they do
**not** define a bare `function sketch(p, options, assets)` (that older pattern in
`docs/SKETCH_CREATION_GUIDE.md` is outdated). The real shape:

```js
import options from "@/p5/utils/options.js";
import sketch, { getP5 } from "@/p5/utils/sketch.js";

sketch.setup( () => { /* one-time setup */ } );

sketch.draw( ( time, center ) => {
  const p = getP5();               // the live p5 instance
  const o = options.sketch;        // this sketch's custom params (from options.ts)

  p.clear();
  p.background( ...( o.backgroundColor ?? [ 0 ] ) );
  // …draw using p, o, and the rich helpers in @/p5/utils/*
} );
```

The `time` argument is a **duration-scaled loop clock** (not raw elapsed seconds), so
animations stay in sync between live preview and deterministic frame capture. Reach for
the shared utilities in `@/p5/utils/` (animation, easing, colors, grid, shapes, mappers,
audio, webcam, interaction, slides, title, …) instead of reinventing them.

### Sketch metadata & registries are generated — never hand-edit

`scripts/watch-sketches.mjs` scans `src/templates/` and (re)generates three files:

- `src/templates/metadata.json` — catalogue used by the gallery/editor
- `src/generated/sketchModuleRegistry.ts` — literal `import()` thunks (per-sketch code splitting)
- `src/generated/sketchOptionsRegistry.ts` — options loaders

Regenerate with `npm run sketch:meta:write` (or run `npm run watch` during dev). A
**pre-commit hook** auto-syncs these whenever a `src/templates/**` or template-asset file
is staged, and `src/templates/__tests__/sketches.test.ts` guards against drift — so if you
add/rename/remove a sketch, let the generator update these files rather than editing by hand.

Visibility markers: touch `.hidden-home` / `.hidden-template` inside a sketch dir to hide it.

## Recording pipeline (high level)

1. `POST /api/recordings/enqueue` validates options, persists a `Job` (Prisma), and enqueues on BullMQ.
2. A BullMQ worker (`src/services/RecordingWorkerService.ts`) picks it up and runs `lib/runRecording.ts`.
3. For backend recording, Playwright loads the sketch route in headless Chromium, captures
   frames deterministically, and FFmpeg encodes them to MP4; outputs upload to S3/MinIO.
4. Multi-slide sketches render one video per slide (arrays of `videoUrls` / `thumbnails`).
5. The dashboard streams progress; `Template` → `TemplateSnapshot` (immutable options) → `Job`
   is the persistence chain (see `prisma/schema.prisma`).

In-browser recording uses the same engine `SketchEngine` capture methods
(`beginDeterministicCapture`, `seekAndDraw`, `captureFrame`) via `src/engines/recording/`.

## Feature flags

Optional features are gated by env vars mapped to `NEXT_PUBLIC_*` build flags in
`next.config.ts` (all default **off**; `NEXT_PUBLIC_*` are baked in at build time):

| Var | Enables |
|---|---|
| `INTERACTION_BINDINGS` | Bind sketch params to live inputs (webcam, mic, orbit, noise, gyroscope) |
| `PREVIEW_ON_HOVER` | Animated template previews on hover |
| `LIVE_THUMBNAIL` | Live thumbnail mirroring the main canvas |
| `NOTIFICATIONS` | Web-push notifications (`npm run setup:notifications` for VAPID keys) |
| `BACKEND_RECORDING` | Server-side Playwright/FFmpeg recording |

## Code style & conventions

Style is enforced by ESLint (`@stylistic` plugin) + `lint-staged` on commit. Key rules —
match the surrounding code, and let `npm run lint:fix` handle formatting:

- **Double quotes**, **semicolons required**, **2-space indent**, **no trailing comma**.
- Spacing inside `( … )`, `[ … ]`, `{ … }`, and JSX `{ … }` is **required** (`p.push( )` style).
- Multi-item arrays/objects and multi-arg calls/imports go **one item per line**.
- Blank line required after a group of `const`/`let`/`var` declarations.
- TypeScript is `strict` with `strictNullChecks`. Prefer the `@/…` path aliases over deep relative imports.
- `.js`/`.jsx` are allowed (sketches, some utils); app/lib/component code is `.ts`/`.tsx`.

## Working agreements

- **Branch**: develop on the assigned feature branch; never push to `main` without explicit permission.
- **Before finishing**: run `npm run check` (lint + test). For sketch or route changes, also
  `npm run build`, since the build compiles every sketch route.
- **Generated files** (`src/generated/*`, `src/templates/metadata.json`) come from the
  sketch generator or Prisma — regenerate, don't hand-edit.
- **Migrations**: change `prisma/schema.prisma`, then `npx prisma migrate dev` — don't edit generated migration SQL after the fact.
- **`docs/` is historical**: it holds many point-in-time design/feature/fix write-ups.
  `ARCHITECTURE.md` is a good conceptual overview, but treat specific code snippets there
  (and the old `function sketch()` signature in `SKETCH_CREATION_GUIDE.md`) as potentially
  stale — verify against current source before relying on them.
```
