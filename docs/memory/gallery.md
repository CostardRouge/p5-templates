# Gallery — the browser-side snapshot archive

Read before touching `src/lib/gallery/`, the `/gallery` page, the Keep button, the keep-after-export hook or the `gallery.*` agent commands. The vision and what the maintainer settled are in `agent-roadmap.md` (track B); this file is what was built and why.

## What an entry is, and where it lives (2026-10-11)

**Decision.** One entry per PIECE: the whole options document as the form held it (`SketchOption`, cloned), a ~240 px JPEG of the frame on screen, the sketch's route tail (`engine/category/name`), a date, a free title, an origin (`export` | `keep` | `agent`), and a `hadAssets` flag. Never the video, never the uploaded media (`agent-roadmap.md`: 95–99 % of sketches have none; a relaunch tolerates a missing path and the card says "had assets"). **Where**: IndexedDB — the first real browser store in the app (`idbBackend.ts`: database `sketchbook-gallery`, one object store `entries` keyed by `id`, thumbnails as Blobs beside the document; one transaction per call, no long-lived connection; `onversionchange` closes and reopens lazily). A hand-rolled 80-line wrapper rather than idb/dexie: five operations do not earn a dependency. **How to apply**: everything goes through `GalleryStore` (`store.ts`), which is backend-agnostic — `memoryBackend.ts` is what the tests and a runtime without IndexedDB (SSR) get, so nothing checks for the API first; `getGalleryStore()` is the page-wide singleton. The store is observable (`subscribe`) so the page re-reads after its own writes or an agent's in the same tab; another TAB is not notified (no BroadcastChannel yet — reopen or reload the page).

## The cap is 500 entries, oldest pruned (2026-10-11)

`GALLERY_CAP = 500`, enforced on every `add` (the oldest by `at` go first; `add` answers the ids it pruned). At ~30 KB an entry that is ~15 MB, far under any quota, and five pieces a week fills it in two years. More than that is what the archive backup is for (below). Raising it is one constant; there is no quota probe on purpose — a `QuotaExceededError` surfaces as a failed keep, not a silent drop.

## Same piece = same canonical document (2026-10-11)

`canonical.ts`: keys sorted at every level, arrays in order, `undefined` dropped, the root `id` (the job a document was loaded from) left out; `fingerprintDocument` is two 32-bit FNV-1a digests plus the length. A keep dedupes against the NEWEST entry of the same sketch only — "nothing changed since the last time" is the question, not "has this ever been kept". `documentHasAssets` spots a `global/…` or `slide-N/…` path (`getScopeAssetPath`'s shape) anywhere in the document; a bundled `assets/images/test/…` default is not an upload.
