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
2. **Contact sheet of the loop** — the agent sees one frame per call; judging motion takes many seek+snapshot round trips. Wanted: one command answering N frames spread over the loop as ONE image (the headless server's `render.stills` already does this server-side — reuse its layout idea, not its code).
3. **Grouped undo** — every agent write is its own history entry, so "apply the theme" takes many ⌘Z. Wanted: a command-level batch (`FormUndoRedo` has `startBatch`/`endBatch`) so one agent request = one undo step.
4. **Describe a sketch** — options and labels, but no intent ("what is this sketch, how does it usually look"): a short description + tags per sketch (in `metadata.json` via the generator, or beside `options.ts`) so an agent picks the right sketch for a theme without opening each.
5. **Interactive bindings** — the `interactive` namespace (MIDI, audio, gyroscope, pointer → parameter) is readable via `document.get` but no command creates or edits a binding.
6. **Local files** — an image on disk must be base64'd by the agent; deliberately no file-read primitive in the relay. If it grates: an allow-listed folder only.
7. Out of scope for the MCP: unattended rendering without a tab (level 2), writing a NEW sketch (that is code in the repo + a deploy).

## Track B — the snapshot gallery (proposal, 2026-10-11)

Maintainer's vision: replace what the backend's recordings gallery gave (finding past work) with a **browser-only archive**. Every piece recorded / exported / saved keeps a dated entry: the full options JSON (a snapshot of the document) + a thumbnail — **not the video** (30–60 MB each, ~5 a week: too heavy for browser storage). A new page lists the entries by date; opening one relaunches the sketch with exactly those options, to manipulate again. The MCP reads and writes the same archive, so an agent gets a memory in the tab: "take last week's pieces and make variants with another palette / text / seed".

Open design points to settle before building (see the session that decides them): storage (IndexedDB, which the app may already use — check before adding), what triggers an entry (every export? an explicit "keep"?), uploaded images referenced by the options (blobs must be archived with the entry or the snapshot cannot relaunch), backup/export of the archive (a JSON/zip download so clearing site data does not lose it), quota, and a common `seed` field (randomness is per sketch today — e.g. `voronoi-v1-cells` reseeds on every load, so its options alone do not reproduce a frame).
