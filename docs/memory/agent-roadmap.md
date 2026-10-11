# Agent roadmap — what the studio MCP can do, what it lacks, what comes next

Read before extending the studio MCP (`src/lib/agent/`, `scripts/mcp/studioRelay.ts`) or building the snapshot gallery. The command set and its decisions live in `agent-commands.md`; this file is the plan.

## Scope set by the maintainer (2026-10-11)

- **Automation happens in an OPEN TAB only**, for now: a scheduled Claude Code task drives a studio tab connected through the relay. No headless/server rendering — level 2 stays deferred (`MEMORY.md` open items), nobody but the maintainer uses the backend.
- The front-end is the product surface: direct feedback, better render performance than the server, works on a static deployment.
- Two tracks run in parallel, **one session each** so their contexts and diffs stay apart: (A) agent autonomy (the gaps below), (B) the browser-side snapshot gallery (below).

## What an agent can already do (verified end to end, 2026-10-10/11)

Read a sketch's options (`sketch.describe`: JSON Schema with ranges, choices, labels), set them (refused out of range, never clamped), look at the result (`studio.snapshot` answers an image), iterate. Concretely: art-direct a sketch to a theme; build slide variants (`slides.*`) and compare snapshots; compose text / image / HUD layers and place them by their visible centre (`content.*`, `assets.add` from base64 or URL); export several formats in one go (`export.*`, files written by the relay to `~/Movies/Sketchbook`); map outside data (weather, music, a date) to settings — the agent fetches it, the tab applies it; open any sketch (`studio.open`).

## Gaps, in the order agreed to tackle them (track A)

1. **Save and share** — no command saves a draft or preset or yields a share link: a good variant lives only as long as the tab, or as an exported file. Track B's gallery is the natural home (an agent command to snapshot the current piece into it, and to list/reopen entries).
2. ~~**Contact sheet of the loop**~~ — DONE 2026-10-11: `studio.contactSheet` (`agent-commands.md`).
3. ~~**Grouped undo**~~ — DONE 2026-10-11: every command's `run` is one undo step, and `studio.batch` runs a list as one (`agent-commands.md`).
4. ~~**Describe a sketch**~~ — DONE 2026-10-11 for the mechanism (`about.json` → `metadata.json` → `sketches.list` with `tag` / `query`, `sketch.describe`; `sketches.md`); 14 sketches described, the other ~320 still list with their id only.
5. ~~**Interactive bindings**~~ — DONE 2026-10-11: `bindings.targets` / `list` / `add` / `update` / `remove`, through the affordance's own write path; unavailable on a build without `INTERACTION_BINDINGS=true` (`agent-commands.md`). Not covered: MIDI learn, a sketch-declared `binding: { control }`.
6. **Local files** — an image on disk must be base64'd by the agent; deliberately no file-read primitive in the relay. If it grates: an allow-listed folder only.
7. Out of scope for the MCP: unattended rendering without a tab (level 2), writing a NEW sketch (that is code in the repo + a deploy).

Still open after the 2026-10-11 session (track A): the remaining sketch descriptions (write them category by category after a `studio.contactSheet` of each); `studio.open` across engines (p5 → GSAP) once timed out at 60 s in a headless run that had just driven two raymarched sketches, with a React "synchronously unmount a root" warning — not reproduced in isolation, worth a look if an agent reports it; the `objects` param type added to the registry for `studio.batch` is to be ported to Atelier.

## Track B — the snapshot gallery (proposal, 2026-10-11)

Maintainer's vision: replace what the backend's recordings gallery gave (finding past work) with a **browser-only archive**. Every piece recorded / exported / saved keeps a dated entry: the full options JSON (a snapshot of the document) + a thumbnail — **not the video** (30–60 MB each, ~5 a week: too heavy for browser storage). A new page lists the entries by date; opening one relaunches the sketch with exactly those options, to manipulate again. The MCP reads and writes the same archive, so an agent gets a memory in the tab: "take last week's pieces and make variants with another palette / text / seed".

What exists to build on (surveyed 2026-10-11):
- **No IndexedDB / Cache API / OPFS anywhere**, and no idb/dexie dependency; the browser holds only small JSON in localStorage (UI prefs, `sketchbook.export.variants.v2:<sketchKey>`) and sessionStorage (`sketchbook:pending-import`, `sketchbook:agent-relay`). The gallery is the first real browser store — IndexedDB is the fit (Blobs, ~hundreds of MB quota, async).
- **Saving today is all server**: Save draft / autosave / clone POST a `Job` through `/api/recordings/enqueue` (Postgres + S3), only when `BACKEND_RECORDING`; the `Preset` / `PresetSnapshot` models exist in the schema and NOTHING uses them. Client-only already: options JSON export/import (`OptionsImportExport.tsx`, `handleImportOptions`), share links (`src/lib/embedOptions.ts`, sketch delta only — no assets, no slides).
- **Uploaded images do not survive a reload**: `window.__blobAssetMap` (`src/lib/assets/blobMap.ts`) is memory-only, and `resolveAssetURL` finds `global/images/x.png` again only through a job's S3 folder. So an archived entry MUST carry its asset bytes (as IndexedDB Blobs keyed by path) and re-register them through `registerBlobUnique` on relaunch, or it cannot relaunch.
- **A thumbnail maker exists**: `captureThumbnailFromCanvas` (`SketchOptions/utils/thumbnailUtils.ts`) — 240 px wide JPEG q0.85, tens of KB; slide thumbnails use it. `captureFreshPngBlob` gives full-size PNG.
- **Seeds are per sketch**: 58 of 334 options files carry a seed (e.g. voronoi `seed: 7`, noise-strips `noise.seed`), others call `Math.random()`. A "change the seed" variant needs a convention (find the leaf named `seed`, as `snapKeys: ["seed"]` already does for progressions) rather than a new common field. Note: two backend jobs of `voronoi-v1-cells` with identical options still differed on every frame despite its seed (`recording.md`) — cause not found; check before promising "same options = same image".

Settled with the maintainer (2026-10-11):
- **Uploaded assets are NOT archived.** 95–99 % of sketches have no image/audio/video asset, and the maintainer adds the rare ones by hand (often from a phone), never through the MCP. An entry stores the options JSON as is; on relaunch a missing asset path is tolerated (a placeholder or simply absent), and the gallery can say "had assets, not kept". Do not build asset blobs into IndexedDB.
- **Backup of the archive is required**: export and import of the whole gallery as one file (format free — a zip of JSON + thumbnails, or one JSON with the thumbnails inline; pick what is simplest to restore).
- **Seeds are not a gallery concern.** They are per sketch, sometimes drive only part of a sketch, and "change the seed" will not be an MCP command. Nothing to design.
- Both tracks run NOW, in two separate cloud sessions, each opening its own PR; the maintainer reviews and merges.

Open design points left to the gallery session: what triggers an entry (every export + an explicit "keep"), one entry per piece, pruning/quota, and the gallery page on a static deployment versus with the backend (`/recordings` stays as is).
