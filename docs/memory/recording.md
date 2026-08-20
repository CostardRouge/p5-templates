# Recording

Read before touching capture, the job queue, the Playwright/FFmpeg path or how artefacts are stored.

## One capture contract, two runners

2026-08-20 — In-browser recording and headless backend recording are not two implementations: both drive the engine's deterministic capture methods (`beginDeterministicCapture`, `seekAndDraw`, `captureFrame`) through `src/engines/recording/`. What differs is the recorder strategy (`RealtimeRecorder` vs `AsyncLoopRecorder`) and the encoder (`MediabunnyEncoder`, `GifEncoder` in-browser; FFmpeg on the server). **How to apply**: a capture bug is usually in the engine's capture implementation, not in the recorder — fix it there and both paths benefit. Adding an output format means an encoder, not a second pipeline.

## The backend path, end to end

2026-08-20 — `POST /api/recordings/enqueue` validates options, persists a `Job` through `src/lib/jobStore.ts` and enqueues on BullMQ (Redis). `RecordingWorkerService` — a singleton with configurable concurrency — picks it up and calls `src/lib/runRecording.ts`, which allocates a temp workspace under `os.tmpdir()/<jobId>`, then `src/lib/recordSketch.ts` drives headless Chromium over the sketch route, captures frames deterministically, and FFmpeg encodes them. Outputs upload to S3/MinIO. Progress is reported through `src/lib/progression/` as named steps, which is what the dashboard streams. **How to apply**: when a recording fails, the job row and its progression steps say which stage died — read them before instrumenting anything. The whole path is gated by the `BACKEND_RECORDING` flag (`docs/memory/architecture.md`), so with the flag off it is simply absent, not broken.

## Multi-slide recordings produce arrays

2026-08-20 — A sketch with `options.slides` records one video per slide, so a job's `videoUrls` and `thumbnails` are arrays even for the single-slide case (`recordSketch.ts` writes a one-element array). Between slides the recorder re-navigates and waits on a `[data-slide="<n>"]` selector — deliberately engine-agnostic: p5 sets that attribute on its canvas, DOM engines on their root element. Per-slide settings are the slide's override merged over the sketch's animation config. **How to apply**: never assume a single video URL when consuming a job. If a new engine is added, it must set `data-slide` or multi-slide capture will hang waiting for a selector that never appears.

## FFmpeg is a runtime system dependency

2026-08-20 — FFmpeg is not an npm package here: the Docker runtime stage `apt-get install`s it, and both Docker stages start from `mcr.microsoft.com/playwright:v1.59.1-jammy` so headless Chromium and its system libraries come pre-installed rather than being downloaded at build time. **How to apply**: backend recording on a bare machine needs FFmpeg on `PATH` and Playwright's browsers installed — it will fail at encode time otherwise, not at startup. When bumping `playwright` in `package.json`, bump the Dockerfile base image tag to match; a mismatch between the npm client and the image's bundled browser is the failure mode to expect.
