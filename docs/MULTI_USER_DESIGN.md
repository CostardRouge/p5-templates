# Multi-User Design — Personal Sketch Libraries

> Status: design proposal (POC). Companion to the `Multi-user support` item in `TODO.md`.

## 1. Goal & non-goals

**Goal.** Let each visitor build, keep, and retrieve their own collection of
sketch *presets*: a sketch slug + the `formValues` they tuned in the options
panel, with a name and a small thumbnail. "Multi-user" here means *people can
find their stuff again*, not *people get hosting*.

**Non-goals (explicit, cost-driven):**

- **No video hosting.** Backend recording (Playwright + FFmpeg + S3) stays a
  private/owner feature. A 10 s 1080p30 H.264 clip is 10–40 MB; hosting per-user
  videos on a hobby VPS does not scale and is not the product.
- **No heavy asset hosting** in user space (images/videos dropped into
  sketches). Presets reference assets; they don't embed them. This mirrors the
  existing behaviour of `POST /api/options/import/[id]`, which already strips
  `assets` from imported options.
- **No collaborative editing**, orgs, sharing ACLs, etc.

## 2. What a "preset" is (and weighs)

| Item | Content | Typical size | Notes |
|---|---|---|---|
| Options JSON | `formValues` (+ slides) | 1–50 KB | Pure JSON; assets are referenced by path, never embedded (`src/lib/assets/blobMap.ts`, `resolveAssetURL.ts`) |
| Thumbnail | one WebP/JPEG poster frame, ≤ 512 px | 20–60 KB | Capture already exists client-side (`captureCanvasThumbnail.ts`) |
| Assets | user-dropped images/videos | 100 KB – 100 MB | **Out of scope** for saved presets — stripped, like the options import route does |

So a realistic library of 100 presets with thumbnails is **2–10 MB**. That is
the order of magnitude everything below is designed around: tiny.

## 3. Architecture options considered

### Option A — Local-first, no accounts ("the user brings their database")

All user data lives in the browser, in **IndexedDB** (not `localStorage`,
whose ~5 MB quota is too small for thumbnails). One object store for presets,
one for thumbnail blobs.

- **Portability**: "Export library" downloads a single `library.json` (or
  `.zip` including thumbnails); "Import library" merges it back. The exported
  file *is* the user's database — they can stash it in their own cloud, move
  machines, share it.
- **Durability**: call `navigator.storage.persist()` to opt out of eviction;
  IndexedDB quota is browser-managed (Chrome: up to ~60 % of free disk;
  Safari: ~1 GB before prompting) — never a constraint at our sizes.
- **Sharing**: a "share link" encodes options into the URL.
  `minifyAndEncodeCaptureOptions.ts` already does base64; switch to
  `lz-string` compression and keep URLs under ~2 000 chars (beyond that, a
  short-code needs a server — see the existing `Sharable sketch link` TODO).

**Pros**: zero infra cost, zero auth, total privacy, works offline (PWA
groundwork already exists).
**Cons**: library is per-browser/per-device; clearing site data deletes it
(mitigated by export + persist()); no cross-device sync without manual
export/import.

### Option B — Server accounts in the existing Postgres

Add `User` + `Preset` tables to `prisma/schema.prisma`, scope queries by
`userId`. Auth via **Auth.js (NextAuth v5)** with OAuth (GitHub/Google) or
email magic links — no password storage to secure.

**Pros**: real cross-device persistence; preset JSON is so small that the
existing Postgres absorbs thousands of users for free.
**Cons**: auth surface to build and maintain; the instance becomes a service
with abuse potential (see §6); thumbnails need either S3 quota or DB storage.

### Option C — One database *per user* (the "mono-database" idea)

Two readings of this idea:

- **C1 — server-side SQLite file per user** (Turso-style): rejected. Prisma is
  wired to a single Postgres datasource; per-user files mean N× migrations,
  backups, and connection juggling — heavy machinery to store kilobytes.
- **C2 — truly client-side database**: this is Option A. IndexedDB (or
  SQLite-wasm over OPFS if relational queries are ever needed — they aren't
  for a list of presets) *is* the per-user session DB, and the exportable
  library file is its portable form.

**Conclusion: C2 ≡ A.** The "user comes with their own database" instinct is
right, and the browser already provides that database.

## 4. Recommended plan: A first, B as opt-in sync

### Phase 1 — Local library (no backend changes)

1. `src/lib/library/` — small IndexedDB wrapper (or Dexie):
   `Preset { id, sketchSlug, name, formValues, thumbnailBlobId, createdAt, updatedAt }`.
2. UI: "Save preset" in `TemplateOptions` / `CaptureActions`; "My presets"
   panel on the sketch page + a "My library" page listing presets across
   sketches (grouped by sketch, thumbnail grid — reuses templates-gallery UI).
3. Loading a preset = the existing options-import flow, minus the file dialog.
4. Export/import of the whole library (JSON, thumbnails embedded as base64 or
   zipped via the already-present `archiver`/`tar` deps server-side — or
   client-side zip).
5. Share links with `lz-string` (upgrade `minifyAndEncodeCaptureOptions`),
   opening the sketch in the existing read-only options mode.

Delivers ~80 % of the value with **zero** new server cost or auth.

### Phase 2 — Optional accounts for sync (server)

1. Auth.js + Prisma adapter; `User` model; OAuth + magic link.
2. `Preset` table mirroring the Phase-1 shape (`@@index([userId, sketchSlug])`),
   synced last-write-wins from the local library (local stays the source of
   truth; the server is a backup/sync target — keeps offline working).
3. Thumbnails: store in S3/MinIO under `users/{userId}/thumbnails/` **or** as
   `Bytes` in Postgres. At ≤ 60 KB each, either is fine; S3 keeps the DB lean.
4. Scope `Job`/`PushSubscription` with a nullable `userId` FK (existing rows
   stay `NULL` = owner/legacy).

### Server-side limits (Phase 2)

| Limit | Value | Rationale |
|---|---|---|
| Presets per user | 200 | ~100× expected usage, still ≤ 10 MB/user worst case |
| Options JSON size | 100 KB (validated on write) | 2× the largest real-world options seen |
| Thumbnail | 1 per preset, WebP ≤ 100 KB, ≤ 512 px | server re-encodes via existing `sharp` dep |
| User assets | none (stripped, as today) | the whole point |
| Total per user | ~30 MB hard ceiling | trivially monitorable |

## 5. What users do about videos & assets

- **Browser recording already works without the backend** (RealtimeRecorder /
  AsyncLoopRecorder → local download). That stays the public recording path:
  their disk, their bandwidth.
- Presets that referenced dropped-in assets reload with placeholders; the user
  re-drops files (blob map repopulates). Document this honestly in the UI
  ("assets are not saved with presets").

## 6. Security prerequisite (independent of the above)

Today every API route is public: any visitor can list all recordings, download
options, and — worst — `POST /api/recordings/enqueue` + `start`, spawning
Playwright/FFmpeg on the VPS. Before the instance is opened to real users:

- gate backend recording behind auth (owner/admin role) or build with
  `BACKEND_RECORDING=false` for the public instance;
- rate-limit mutating routes;
- scope `/api/recordings*`, `/api/options/*`, `/api/progression/*` by owner
  once `userId` exists.

## 7. Suggested sub-tasks (for TODO.md)

- [ ] Phase 1: IndexedDB preset library (`src/lib/library/`)
- [ ] Phase 1: Save/load preset UI on sketch page + "My library" page
- [ ] Phase 1: library export/import (single file)
- [ ] Phase 1: compressed share links (lz-string, read-only mode)
- [ ] Phase 2: Auth.js + `User`/`Preset` models + sync endpoint with limits
- [ ] Phase 2: `userId` on `Job`/`PushSubscription`; scope APIs
- [ ] Security: gate/disable backend recording on public instances; rate limiting
