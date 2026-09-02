# Project memory — decisions, reasons, traps

Long-term memory of this repo, read at the start of **every** agent session (imported by `CLAUDE.md`). It holds what the code and `git log` cannot tell you: the choices made and their reasons, what was tried and rejected, the traps that cost time, how the maintainer likes to work.

This file is the **always-loaded index**. The detail lives in `docs/memory/<topic>.md`, one file per area, loaded **on demand**: read the topic file(s) matching the area you are about to touch **before** acting (table at the bottom). Do not `@import` them into `CLAUDE.md` — the split exists to keep the per-session prompt small.

## How to maintain (mandatory — CLAUDE.md rule 2)

- **When**: at the end of every task, before its commit, in the same commit. Writing is the **default**; only skip if there is truly nothing a future agent could use, and say so explicitly in the final message.
- **What**: a design/product decision, a non-obvious technical choice, an explicit rejection ("the maintainer did not want X because Y"), a trap (browser, tooling, framework, hosting) and its remedy, a working preference. Not implementation detail readable in the diff, not what `git log` already says, not history ("this was fixed on…") — once a fix is committed, keep only the rule it taught.
- **Where**: the matching `docs/memory/<topic>.md`; a new file only when no topic fits (kebab-case name, add it to the table below with a "read when"). Cross-cutting rules, working style, decisions-at-a-glance and open items stay in this index.
- **How**: search first and **update** the existing entry rather than adding a near-duplicate; delete what became false. One entry = one short paragraph: *decision → why → how to apply*, dated `YYYY-MM-DD` on first write and on each revision. Say the same thing **once** — cross-reference other files by name instead of repeating.
- **Language**: **English**, dense, factual. No session narration.
- Budget: keep this index under ~200 lines and each topic file under ~150; if one outgrows that, split it.

## Working with Steeve Pommier

<!-- Fill in as you learn: how they validate work, how they phrase requests,
     what they want when an audit finds problems, what annoys them. -->

- 2026-08-20 — Work reaches `main` through pull requests: every feature commit on `main` has a paired `(#NNN)` merge commit. Open a PR; do not push to `main`.
- 2026-08-20 — Commit bodies here are long and explanatory (see `Fix engine double-mount race exposed by Next 16.3 dev mode`): symptom, root cause, why the obvious fix did not work, how the result was verified. Match that depth — a one-line body reads as unfinished work.
- 2026-08-20 — Verification is expected to be empirical, not asserted. Recent commit bodies end with what was actually observed ("one canvas, pause freezes the frame, … a fully opaque 1080×1350 PNG"). The `verify` skill in `.claude/skills/verify/` exists for exactly this.
- 2026-08-20 — Automation is preferred over discipline: a `/fix-lint` bot, a pre-commit hook that regenerates the sketch catalogue, a custom git merge driver for it, a regression test that fails on drift. When a rule can be enforced by tooling, enforce it there rather than writing it down.

## Direction in five lines

- Sketchbook turns creative-coding sketches into a product surface: pick a sketch, tweak its parameters in an auto-generated form, preview it live, export an image or a video.
- The rendering layer is deliberately engine-agnostic: p5.js, GSAP and Three.js are peers behind one `SketchEngine` interface, and one recording pipeline drives all of them.
- A sketch must render identically in the live preview and in deterministic headless capture; that constraint shapes the loop clock and the capture API.
- Sketches are the content, and they are versioned in place (`churros-v1-circle` … `churros-v11-perspective`) so earlier versions stay reachable rather than being edited away.
- It self-hosts: a push to `main` publishes a Docker image that a NAS pulls within seconds. There is no PaaS and no staging to hide operational choices behind.

## Decisions at a glance (details in the topic files)

- Every rendering back-end implements `SketchEngine`; nothing special-cases an engine → `architecture.md`.
- Deterministic capture is a constraint on sketches: animate from the loop clock, never wall-clock time → `architecture.md`.
- Optional features are compile-time `NEXT_PUBLIC_*` flags, default off, baked in at build time → `architecture.md`.
- Prisma models were renamed Template → Preset behind `@@map`, so the database columns still say "template" → `architecture.md`.
- Sketches live in `src/sketches/<engine>/`; `src/templates/` has not existed since 4946ea6, and `/templates` URLs survive as 308 redirects → `sketches.md`.
- The sketch catalogue and import registries are generated, hook-synced, drift-tested and merge-driver-resolved — never hand-edited → `sketches.md`, `tooling.md`.
- Sketch variants are added as new `-vN` directories rather than edited in place → `sketches.md`.
- All internal navigation is client-side `next/link`; the hard-reload `HardLink` workaround is gone and must not come back → `sketches.md`.
- `/embed` is a **published contract**: steevepommier.com/motion frames 44 sketches by URL, so a sketch rename breaks a live page on another domain → `sketches.md`.
- In-browser and backend recording share one capture contract; only the recorder strategy and encoder differ → `recording.md`.
- Two TypeScript compilers coexist on purpose — `typescript` 6 for ts-jest/typescript-eslint/`next build`, `typescript7` for `npm run typecheck` → `tooling.md`.
- `@stylistic` via ESLint is the formatter; Prettier is explicitly disabled in `opencode.json` → `tooling.md`.
- CI gates on four parallel jobs; the build job exists to compile every sketch route → `testing-and-ci.md`.
- Deployment is event-driven: GHCR image plus a Watchtower HTTP API call on a NAS, replacing registry polling → `deployment.md`.
- Analytics is self-hosted Umami with auto-track off and a hand-rolled pageview queue; an empty website id disables it → `architecture.md`, `docs/analytics.md`.
- Dev-only studio affordances are hidden behind a menu toggle, off by default, so the app reads and screenshots as the shipped product → `studio-ui.md`.
- HUD telemetry widgets are seven standalone `hud-*` content-item types (own style, own layer row, eye toggle); the legacy single `hud` container is expanded lazily on read, before the zod parse → `studio-ui.md`.
- The sketch page is one inspector (canvas+animation above the sketch form), a content rail, a bottom filmstrip and Export in the docked top bar; "document" is not a UI scope and the filmstrip is not a timeline → `studio-ui.md`.
- Front-end export is a list of variants, each re-laying the sketch out at its own resolution and framerate; the variant list doubles as the run queue → `studio-ui.md`, `recording.md`.
- Export-time size/framerate overrides go through one scope that strips per-slide overrides, re-applies after every slide switch, waits for the resize to land, and always restores → `recording.md`.
- A finished export can be previewed in place and handed to the OS share sheet — the only route from a browser export to iOS Photos → `recording.md`.
- No export loop may `await` a bare `requestAnimationFrame`: a frame that never comes hangs the run rather than slowing it → `recording.md`.
- Every positioned content item is grabbable on canvas, and that takes three aligned edits (type set, anchor resolution, renderer-reported bounds) — not just a schema → `canvas-interaction.md`.
- The viewport's wheel pans and only a pinch (touch, or ctrl+wheel as browsers report a trackpad pinch) zooms; the wheel recogniser must skip ctrl+wheel itself → `canvas-interaction.md`.
- A binding is data resolved at read time, in its own `interactive` namespace; its five kinds share one signal pipeline and differ only in the mapping and the fold rule → `interaction-bindings.md`.
- The home page documents the editor surface by surface with real screenshots of it, as a server component slotted into the client page → `home-and-seo.md`.
- An asset path is minted from the file's name, and a name is not an identity — every iOS camera-roll pick is `image.jpg` → `assets.md`.
- A script-opened file input must be rendered (`HIDDEN_FILE_INPUT_CLASS`, never `hidden`) and its trigger must be a real control — iOS Safari ignores both otherwise, silently → `assets.md`.
- Pixels that become a file travel as a Blob; a data URL is a mobile-Safari dead end → `assets.md`, `recording.md`.
- A whole sketch can be a layer inside another sketch (`sketch` content item), by overriding module singletons — the surface, the options, the registration, and the loop phase when the layer is frozen or offset — never by special-casing sketches → `architecture.md`, `studio-ui.md`.
- The `visual` content item was retired once sketch layers superseded it; its drawing functions are kept, unreferenced, to become sketches → `studio-ui.md`.
- A sketch layer has three distinct sizes — its box, the canvas the sketch lays out for, and the buffer's pixels; conflating them is what made `scale` crop a sketch drawn at absolute pixel sizes → `architecture.md`, `studio-ui.md`.
- A sketch's mutable module-level state goes through `sketch.state()` (one record per page/layer instance, drift-tested), GPU helpers keep GL resources per surface, and layer imports are serialised because there is one registration capture → `architecture.md`, `sketches.md`.

## Open items (dated; remove when done)

- 2026-09-01 — **Loading-screen UX shipped** (poster-as-progress + reserved caption, precomputed total, monotonic progress, 150ms anti-flash). Details and the traps it cost in `docs/memory/architecture.md`. Still open: the engine's `ready` event is not gated on assets settling — `TODO.md` asks for it, but it needs a timeout/failure policy first.
- 2026-08-20 — **`.env.example` is missing.** `setup.sh` runs `cp .env.example .env` under `set -e` and `README.md` points at it for the full env list, but no such file is tracked or on disk, so a fresh clone fails at the first setup step. `.gitignore` now permits it (`!.env.example`); someone who knows the real key set has to author it. Deliberately not inferred here — guessing key names into a template would be worse than its absence.
- 2026-08-20 — `.vscode/settings.json` was untracked as accidental IDE state (it arrived inside a sketch commit, 1ccd877). Its content was genuinely useful: eslint format-on-save matching the repo's `@stylistic` rules. If that is wanted as shared project config, re-add it deliberately with a `!.vscode/settings.json` negation — the file is still on disk.
- 2026-08-20 — `.husky/pre-push` is entirely commented out, so nothing runs `npm run build` before a push; `.github/workflows/lint-fix.yml` records the reason as "a known issue with NEXT_BUILD_DIR resolution". Either fix the resolution and re-enable it, or delete the file. Left alone: hooks are the maintainer's call.
- 2026-08-20 — `fast-check` is a devDependency that nothing imports. Either start using it for the maths helpers or drop it.
- 2026-08-20 — No secret has ever been tracked in this repo (`git log --diff-filter=A -- '.env*'` is empty), so nothing needs rotating.

## Topic files — read before touching the area

| File | Read when you touch… |
| --- | --- |
| `docs/memory/architecture.md` | The engine abstraction, feature flags, `next.config.ts`, bundling, the Prisma models |
| `docs/memory/sketches.md` | Adding, renaming or editing a sketch; the generated catalogue; sketch routes |
| `docs/memory/recording.md` | Capture, the BullMQ queue, Playwright/FFmpeg, multi-slide output |
| `docs/memory/assets.md` | Uploading a file, asset paths, the blob registry, the p5 image cache |
| `docs/memory/tooling.md` | TypeScript, ESLint, git hooks, merge drivers, `.gitignore` traps |
| `docs/memory/testing-and-ci.md` | Tests, Jest config, CI workflows, what gates a merge |
| `docs/memory/deployment.md` | Docker, GHCR, Watchtower, the NAS, `docker-compose.yml` |
| `docs/memory/local-development.md` | Running the app locally, infra services, `setup.sh`, dev-server config |
| `docs/memory/studio-ui.md` | The sketch page's panels and layouts (inspector, content rail, filmstrip, export, mobile drawer) |
| `docs/memory/canvas-interaction.md` | The on-canvas drag/selection layer, item-bounds reporting, a renderer's grab surface, the viewport's pan/zoom gestures (wheel vs pinch) |
| `docs/memory/interaction-bindings.md` | Modulating a parameter: the binding resolver, its kinds, the pastille/popover, the interaction sources |
| `docs/memory/home-and-seo.md` | The home page and its studio tour, the capture assets, site metadata, JSON-LD, the sitemap |
| `docs/analytics.md` | Umami config, why auto-track is off, the pageview queue, how to verify tracking (maintained, unlike the rest of `docs/`) |
