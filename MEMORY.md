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
- 2026-08-31 — `TODO.md` is the backlog of record, and it lags the code: a burst of work closes items nobody unticks, so it reads as a longer backlog than it is. Before planning from it, check its claims against the source — and tick what you find done, naming what closed each line, in the same pass.
- 2026-08-20 — Automation is preferred over discipline: a `/fix-lint` bot, a pre-commit hook that regenerates the sketch catalogue, a custom git merge driver for it, a regression test that fails on drift. When a rule can be enforced by tooling, enforce it there rather than writing it down.

## Direction in five lines

- Sketchbook turns creative-coding sketches into a product surface: pick a sketch, tweak its parameters in an auto-generated form, preview it live, export an image or a video.
- The rendering layer is deliberately engine-agnostic: p5.js, GSAP and Three.js are peers behind one `SketchEngine` interface, and one recording pipeline drives all of them.
- A sketch must render identically in the live preview and in deterministic headless capture; that constraint shapes the loop clock and the capture API.
- Sketches are the content, and they are versioned in place (`churros-v1-circle` … `churros-v11-perspective`) so earlier versions stay reachable rather than being edited away.
- It self-hosts: a push to `main` publishes a Docker image that a NAS pulls within seconds. There is no PaaS and no staging to hide operational choices behind.

## Decisions at a glance (details in the topic files)

- Every rendering back-end implements `SketchEngine`; nothing special-cases an engine → `architecture.md`.
- Every engine extends `BaseSketchEngine` and is only the part that differs; the listener map, the performance loop, the frame maths and the capture waits live once, in the base → `architecture.md`.
- A canvas engine's `seekAndDraw` yields one task and never waits a display frame: the frame is drawn when `seek()` returns, a rAF capped exports at the refresh rate and never came in a hidden tab → `recording.md`.
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
- HUD telemetry widgets are nine standalone `hud-*` content-item types (own style, own layer row, eye toggle); the legacy single `hud` container is expanded lazily on read, before the zod parse → `studio-ui.md`.
- A telemetry widget is chosen by the **value shape** it reads, not by the control's look: that decides the quick-add menu, what a source picker lists, and when a new kind is worth minting → `studio-ui.md`.
- The sketch page is one inspector (canvas+animation above the sketch form), a content rail, a bottom filmstrip and Export in the docked top bar; "document" is not a UI scope and the filmstrip is not a timeline → `studio-ui.md`.
- Front-end export is a list of variants, each re-laying the sketch out at its own resolution and framerate; the variant list doubles as the run queue → `studio-ui.md`, `recording.md`.
- Export-time size/framerate overrides go through one scope that strips per-slide overrides, re-applies after every slide switch, waits for the resize to land, and always restores → `recording.md`.
- A run reports phases and numbers, never a formatted string; phase weights are normalised over the phases that output kind really has, and a phase that cannot report a number sweeps rather than inventing one → `recording.md`.
- The export list is a fixed grid whose tracks no cell can move, and a running row is drawn by an inversion sweeping across it — which is why red may never appear inside a row → `studio-ui.md`.
- Export on a phone is the whole screen and the same table, cards having been built and rejected: the bottom sheet's blur was a per-frame GPU pass over a sketch nobody was watching → `studio-ui.md`.
- A finished export can be previewed in place and handed to the OS share sheet — the only route from a browser export to iOS Photos → `recording.md`.
- Capturing is not delivering: a run hands its files over and saving them raises at most one prompt, deferred to an explicit gesture wherever a download is a modal the page cannot observe → `recording.md`.
- No export loop may `await` a bare `requestAnimationFrame`: a frame that never comes hangs the run rather than slowing it → `recording.md`.
- Every positioned content item is grabbable on canvas, and that takes three aligned edits (type set, anchor resolution, renderer-reported bounds) — not just a schema → `canvas-interaction.md`.
- The viewport's wheel pans and only a pinch (touch, or ctrl+wheel as browsers report a trackpad pinch) zooms; the wheel recogniser must skip ctrl+wheel itself → `canvas-interaction.md`.
- A binding is data resolved at read time, in its own `interactive` namespace; its five kinds share one signal pipeline and differ only in the mapping and the fold rule → `interaction-bindings.md`.
- A device-backed channel publishes nothing when it has no value, never a zero — which is what keeps a headless export from depending on hardware being plugged in → `interaction-bindings.md`.
- A sketch declares which physical control drives a field (`binding: { control }`); the map is keyed on the MIDI PORT name, it resolves rather than mints channels, and a declared binding is rebuilt every frame instead of ever being written to the document → `interaction-bindings.md`.
- The home page documents the editor surface by surface with real screenshots of it, as a server component slotted into the client page → `home-and-seo.md`.
- There are two site maps: `/sitemap.xml` for crawlers (`app/sitemap.ts`) and `/sitemap` for people (`app/sitemap/page.tsx`); Next resolves them independently → `home-and-seo.md`.
- The canonical origin has a hardcoded production default (`SITE_URL`) because statically prerendered routes bake their URLs at build time, where a runtime env var is too late → `home-and-seo.md`.
- An asset path is minted from the file's name, and a name is not an identity — every iOS camera-roll pick is `image.jpg` → `assets.md`.
- A script-opened file input must be rendered (`HIDDEN_FILE_INPUT_CLASS`, never `hidden`) and its trigger must be a real control — iOS Safari ignores both otherwise, silently → `assets.md`.
- Pixels that become a file travel as a Blob; a data URL is a mobile-Safari dead end → `assets.md`, `recording.md`.
- A whole sketch can be a layer inside another sketch (`sketch` content item), by overriding module singletons — the surface, the options, the registration, and the loop phase when the layer is frozen or offset — never by special-casing sketches → `architecture.md`, `studio-ui.md`.
- The `visual` content item was retired once sketch layers superseded it; its drawing functions are kept, unreferenced, to become sketches → `studio-ui.md`.
- A sketch layer has three distinct sizes — its box, the canvas the sketch lays out for, and the buffer's pixels; conflating them is what made `scale` crop a sketch drawn at absolute pixel sizes → `architecture.md`, `studio-ui.md`.
- The `flip` category runs on one rule: the edge-on frame is the only place anything may jump — the glyph, the cell count, the framing — and a turn restarts at -90° rather than passing a glyph's own mirror → `sketches.md`.
- A whole board DOES raymarch in one pass: walk the structure instead of uploading it, recompute per-cell values instead of looking them up, and a cell shows one glyph → `sketches.md`.
- In a sphere trace every conservative BOUND must stay above the hit threshold, or the bounding volume renders as a solid slab → `sketches.md`.
- A flooded raymarcher is debugged by probing parameters, then rendering the field, then rendering the march — not by reasoning about the SDF → `sketches.md`.
- Baked cards on WEBGL quads remain the cheap board (v2), at the cost of lighting that no longer turns; the GPU renderer's `offscreen` mode is what bakes them → `sketches.md`.
- A cascade's tree is a pure function of the clock, or it cannot be captured → `sketches.md`.
- A `conditional-group` branch switch rebuilds the whole object from each field's `default`, falling back to a slider's `min` → `sketches.md`.
- A 3D vector is one `vector3d` field kind storing `{ x, y, z }`, edited in an orbitable box: four presentations were built, compared live and cut to that one, and p5 pads set `yDown` → `studio-ui.md`, `docs/vector3d-control.md`.
- A control whose shape is genuinely open is settled by building the variants, publishing them bound to ONE value, and letting the maintainer drive them — not by arguing in a document → `studio-ui.md`.
- A sketch's mutable module-level state goes through `sketch.state()` (one record per page/layer instance, drift-tested), GPU helpers keep GL resources per surface, and layer imports are serialised because there is one registration capture → `architecture.md`, `sketches.md`.
- A `sculpt` is a seeded lattice (rest points + k-nearest links, shared `_lattice.js`) that a wave (shared `_wave.js`) lays tubes on: links from rest positions, the wave in the sculpture's own frame, no p5 noise, the cursor the only state → `sketches.md`.
- A relief sculpt is a GRID sheet (`_sheet.js`) raymarched by domain repetition with a per-node data texture, so it has no link ceiling; the camera's silhouette is a SURFACE traced from landmarks (`_silhouette.js`), tubes only join lifted neighbours (the O stays an O), and the dynamics run on dt in seconds → `sketches.md`.
- A grid sculpt's empty air is a distance, not a march: a per-cell 5 × 5 ceiling texture (`_extremes.js`) lets a ray drop to the sheet for one texel, the wall clamp stays, the margin holds the radius + the whole fillet + the slack; the exact `smin` skip for the uniform-array lattices measured SLOWER and is not shipped → `sketches.md`.
- The sculpt `material.look` select keeps the silhouette artefact and drops the lit body (`fringe`): an opt-in on the shared shading chunk, a select rather than a conditional-group, `tube` the default so nothing published changes → `sketches.md`.
- A shader change is benched and pixel-diffed with `scripts/bench-sketch.mjs` (deterministic frames through `window.__sketchCapture`); trace noise is speckles on every edge, a clustered patch is a bug → `testing-and-ci.md`, `sketches.md`.
- A grid sculpt whose tubes are the subject keeps them in their own module (`_mesh.js`): each cell owns four links, the whole field travels as two data textures addressed per cell, and a letter stays readable through the rasterised-ink mask plus the "link midpoint on the ink" rule, never an outline chain → `sketches.md`.
- Raymarched sketches take the tangible camera rig — tilt, spin, distance, eye offset and target as bindable sliders, `fit` per export aspect, whole-cycle motion — instead of a bespoke orbit → `sketches.md`.
- A new sculpt that wants the scatter takes `_lattice.js` and `_wave.js` and extends them (`skin`, `max`, `budget`) rather than shipping its own sampler and wave; a parallel build that did was rebuilt on them at rebase time → `sketches.md`.
- The gyroscope pointer is a calibrated pose (auto / flat / custom) driving one of four signals (tilt, gravity, acceleration, rotation), publishes nothing until the sensor speaks, and says why in the overlay legend (permission tap, HTTPS, no sensor) → `interaction-sources.md`.

- A session that changes code reports this project's state to `PROJETS.md`, at the root of the private `second-brain` repo: the register is that file, never Claude's memory and never `git log` → CLAUDE.md rule 4

## Open items (dated; remove when done)

- 2026-09-21 — `vector3d` ships ONE view, the orbitable box, chosen at the bench; the other three are proposals again, not code (`docs/vector3d-control.md` §4 — the trackball is first in line if editing a light in a box grates). Still open: a `vector3d` binding kind (`bindingKindFor` returns `null`), a HUD widget over a triple, HUD quick-add, unit-sphere randomization for `kind: "direction"`, colour-coded axis letters, and converting `dragon-corridor`'s `camera.x/y/z` (a stored-shape change).
- 2026-09-21 — The gyroscope's product choices are still the maintainer's to confirm on a phone: which of the four signals is the default (shipped: tilt, marble mapping, auto calibration, smoothing 0.5), whether the "aim" inversion should be the default instead, and the landscape mapping sign (`rotateForScreen`, derived on paper). The decision page built for it lives in the session's artifact; adjust `interactionFormValues.gyroscope` in `interaction/defaults.js` once decided.
- 2026-09-22 — Open in `sculpt`, performance: v1 and v4 still evaluate every link and bulb at every march step (594 / 1102 ms a frame at 540 × 675 under SwiftShader, v2 / v3 now 1412 / 1352); the exact `smin` skip measured slower and is out, so the lever left is a spatial grid in a data texture. v3's dark cell-wall seams on a lifted patch (its 3 × 3 scan sees a wall differently from each side — the trap v2 closed with its 5 × 5 scan) are visible in every capture and untouched here; closing them costs ~16 more capsules per evaluation.
- 2026-09-21 — Open in `sculpt`: four sketches now. A scattered lattice, a sheet of heights and a mesh of links are different data, so nothing is folded together between them; the fourth variant (`sculpt-v4-sphere`) wanted the lattice and the wave and took them, which is the test for any fifth — and each module is named for its content, never for the shape it draws, because two sessions independently reached for `_sheet.js`. Left out of `sculpt-v2-letter-relief` by choice: a 12-cell neighbourhood (three more link channels), a `both` mask mode, a residual wobble on raised points, rings-v10's virtual cursors. `sculpt-v4-sphere`'s thumbnail and previews were captured on its pre-rebase build, and its 128-link budget has not been measured on a phone GPU.
- 2026-09-16, revised 2026-09-21 — Open in `flip`: v3 caps at 8 single glyphs and 64 cells by construction (see `sketches.md`) — a deeper board would need the capsules in a data texture after all, which `noiseFieldGpu`'s `render({ textures })` now supports; and quad (4-way) subdivision is still unexplored, v2 and v3 both splitting in two on alternating axes on purpose, because that is what gives 1 → 2 → 4 → 8. (Thumbnails and previews: every sketch that lacked one has since been captured from the studio; nothing in the repo generates them.)

- 2026-09-01 — **Loading-screen UX shipped** (poster-as-progress + reserved caption, precomputed total, monotonic progress, 150ms anti-flash). Details and the traps it cost in `docs/memory/architecture.md`. Still open: the engine's `ready` event is not gated on assets settling — `TODO.md` asks for it, but it needs a timeout/failure policy first.
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
| `docs/memory/interaction-bindings.md` | Modulating a parameter: the binding resolver, its kinds, the pastille/popover, the channel manifest |
| `docs/memory/interaction-sources.md` | How a sensor, camera or controller becomes a pointer: the collectors in `interaction/index.js`, the gyroscope's modes/calibration/permission, verifying a source without hardware |
| `docs/memory/home-and-seo.md` | The home page and its studio tour, the capture assets, site metadata, JSON-LD, the sitemap |
| `docs/analytics.md` | Umami config, why auto-track is off, the pageview queue, how to verify tracking (maintained, unlike the rest of `docs/`) |
