# Assets — how an uploaded file becomes pixels on the canvas

Read before touching asset upload, the blob registry, path resolution or the p5 image cache.

## Anything destined for a file is a Blob, never a data URL

2026-08-31 — A 1080×1350 frame is a ~1.5MB `data:` URL. Both still-capture paths carried one — the transport's camera button clicked an `<a href="data:…">` that was never added to the document, and the export panel's still variant `fetch()`ed one back into a Blob. Desktop tolerates both; mobile Safari acts on neither, so the camera button did nothing at all there. `captureFreshPngBlob` (`src/lib/canvasSnapshot.ts`) reads `toBlob` directly and is what both use now; `captureFreshPng` survives only for the dev thumbnail route, which posts base64 as JSON. The camera button then hands the file to `shareFiles`, the same share-sheet-or-download contract as `ExportPreview` (`docs/memory/recording.md`) — on iOS the share sheet is the only route to Photos. **How to apply**: a data URL is for embedding in a document, not for carrying pixels to a file; and a capture that produces nothing must surface it (the button shows an error state) rather than failing silently, which is how this went unnoticed.
