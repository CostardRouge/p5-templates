# Local development

Read before setting up the app, changing `setup.sh`, or debugging "it does not start".

## Native app + Docker infra is the recommended shape

2026-08-20 — The documented default is infra in Docker and the Next server native: `docker-compose up -d redis minio postgres` then `npm run dev`. `README.md` marks this as the Apple Silicon recommendation. Full-Docker (`make app-dev`) exists and works, but is the slower path. Ports: app 3000, MinIO console 9001, Postgres 5432, Redis 6379. **How to apply**: reproduce a bug the way the maintainer runs it — native dev server — before blaming Docker.

## `npm run watch` is not `npm run dev`

2026-08-20 — `npm run dev` is the plain Turbopack dev server. `npm run watch` (`scripts/dev-watch.mjs`) runs the dev server **and** the sketch-metadata watcher, so `metadata.json` and the import registries regenerate as sketches change on disk. **How to apply**: use `npm run watch` while working on sketches. With plain `dev`, a newly created sketch simply does not appear in the gallery — that is stale metadata, not a broken sketch, and `npm run sketch:meta:write` fixes it.

## `setup.sh` is currently broken on a fresh clone

2026-08-20 — The script's first action is `cp .env.example .env` under `set -e`, and no `.env.example` exists in the repo (see the open item in `MEMORY.md`). Everything after it — starting the services, `npm install`, `prisma generate`, `prisma migrate deploy` — is fine, and can be run by hand in that order. **How to apply**: do not treat `./setup.sh` as a working first step when helping someone onboard; write the `.env` first, or run the remaining steps manually.

## The dev server is deliberately reachable from other devices

2026-08-20 — `next.config.ts` sets `allowedDevOrigins` to `"*"` plus several LAN addresses, and `crossOrigin: "anonymous"`. That is so sketches can be opened on a phone or tablet on the same network — orientation, touch and gyroscope interactions cannot be tested any other way. **How to apply**: this is intentional dev-only configuration, not a leaked debug setting. Leave it. If a LAN address changes, add it rather than removing the list.

## Feature-flagged work needs a rebuild, not a restart

2026-08-20 — Optional features are compile-time `NEXT_PUBLIC_*` flags defaulting to off (`docs/memory/architecture.md`). **How to apply**: when a feature seems absent locally, check whether its flag was set *for the build* before debugging the feature itself — `INTERACTION_BINDINGS`, `PREVIEW_ON_HOVER`, `LIVE_THUMBNAIL`, `NOTIFICATIONS`, `BACKEND_RECORDING`. Push notifications additionally need VAPID keys (`npm run setup:notifications`).
