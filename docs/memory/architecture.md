# Architecture

Read before touching the engine abstraction, feature flags, the Next config or anything about what ends up in which bundle.

## Rendering is engine-agnostic on purpose

2026-08-20 — Every rendering back-end implements one interface, `SketchEngine` in `src/engines/types.ts`, and the studio route and the recording pipeline only ever talk to that interface. p5.js, GSAP and Three.js are peers, not a primary plus experiments. The contract covers lifecycle (`init` / `destroy`), playback, a typed event map (`ready`, `frame`, `complete`, `error`, `performance`) and deterministic capture. **How to apply**: adding a rendering back-end means implementing `SketchEngine` and registering it in `src/engines/registry.ts` — never special-casing an engine inside the studio page or the recorder. Read `types.ts` before anything else in this area; it is the file the rest of the system is written against.

## Deterministic capture is a design constraint, not a feature

2026-08-20 — The same sketch must produce the same frames in the live preview and in headless capture, otherwise a recording does not match what the user tweaked. That is why the engine interface exposes `beginDeterministicCapture` / `seekAndDraw` / `captureFrame` (`src/engines/recording/`) and why sketches receive a duration-scaled loop clock rather than raw elapsed time. **How to apply**: never drive a sketch's animation from `Date.now()`, `millis()` or frame counters — take the `time` argument. A sketch that reads wall-clock time renders correctly in the browser and wrongly in an export, and nothing in CI will catch it.

## Feature flags are compile-time and default off

2026-08-20 — `next.config.ts` maps five plain env vars onto `NEXT_PUBLIC_*` build flags: `BACKEND_RECORDING`, `NOTIFICATIONS`, `LIVE_THUMBNAIL`, `PREVIEW_ON_HOVER`, `INTERACTION_BINDINGS`. All default off, and `NEXT_PUBLIC_*` values are **baked in at build time**, not read at runtime. **How to apply**: changing a flag means rebuilding — restarting the server is not enough. Toggling one in a running dev server and seeing no effect is expected behaviour, not a bug. The Dockerfile takes the same names as `ARG`s, and the CI build job sets them explicitly (with `INTERACTION_BINDINGS: "true"` so that code path is compiled) — mirror those when reproducing a build failure.

## Server-only dependencies are declared external

2026-08-20 — `serverExternalPackages` in `next.config.ts` lists `@aws-sdk/s3-request-presigner`, `archiver`, `tar`, `bullmq`, `ioredis` and `web-push`: Node-only modules that must never reach the browser and that Turbopack should not parse into the module graph on every server compile. Next already ships `@aws-sdk/client-s3`, `sharp`, `prisma` and `playwright` in its own default external list, so only the uncovered ones are named here. The omissions are deliberate: `mediabunny` and `gif.js` power **client-side** recording and must stay bundled. **How to apply**: before adding to that array, check `node_modules/next/dist/lib/server-external-packages.json` — duplicating Next's list is noise. Never add a package the browser needs.

## The `/embed` route is deliberately framable

2026-08-20 — Every route keeps the browser's default same-origin framing except `/embed/:path*`, which `next.config.ts` serves with a `frame-ancestors` CSP. It defaults to `*` so a fresh install works as a public widget; `EMBED_FRAME_ANCESTORS` (space-separated origins) narrows it. **How to apply**: this is the one place where relaxing a security header is intended — do not "fix" it. Restricting it is a deployment decision made through the env var, not a code change.

## Persistence chain, and a rename done without SQL

2026-08-20 — `prisma/schema.prisma` holds `Preset` → `PresetSnapshot` → `Job` (plus `PushSubscription`). A preset is the mutable named configuration, a snapshot freezes its options, a job renders one. The models were renamed from `Template`/`TemplateSnapshot` but keep `@@map("Template")` and `@map("templateId")`, so the rename cost no migration and the database columns still say "template". **How to apply**: expect the old names in SQL, in migration files and in stored job paths; do not "clean them up" into a migration. The Prisma client is generated to `src/generated/prisma` (gitignored) — run `npx prisma generate` after pulling a schema change, or `npm install`, which does it via `postinstall`.
