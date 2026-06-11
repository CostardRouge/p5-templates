# 📝 Blog backlog — milestones & article ideas

> Backlog of technical articles mined automatically from the project's history
> (git log + diffs + `docs/` folder). See [`README.md`](./README.md) for how the
> loop that maintains this file works.

**Last scan:** 2026-06-08
**Reference commit (scanned HEAD):** `81d5178`
**Scope:** 233 commits · 45 PRs · ~70 notes in `docs/`

Status legend: 🟡 idea · 🔵 ready to write (plenty of material) · ✍️ in progress · ✅ published

---

## 🎬 Flagship series — The evolution of the recording pipeline

This is the project's strongest narrative: 4 successive architectures to capture
a p5 sketch to video, each solving the previous one's limits. Ideal as a
"build in public" series.

### A1 — "How I filmed p5.js: 4 architectures, 3 years of lessons" 🔵
- **Angle:** retrospective of the full evolution, from naive to streaming.
  1. **CCapture.js + tar in the browser** → PNG frames in memory, `.tar` archive,
     download, Node unarchiving, FFmpeg encoding.
  2. **Server-side Playwright capture** → `noLoop()` + `redraw()` + `canvas.toDataURL()`,
     one frame at a time to disk, then FFmpeg.
  3. **FFmpeg streaming** → frames never touch the disk, piped into `stdin`.
  4. **In-browser encoder (Mediabunny / MediaRecorder)** → client-side WebM/MP4 encoding.
- **Key numbers (already measured):** memory 500 MB → 50 MB (−90%), time 45 s → 30 s
  (−33%), stability "crashes past 1000 frames" → "tested up to 10,000 frames".
- **Sources:** `docs/FRAME_CAPTURE_MIGRATION.md`, `docs/GLOBAL_RECORDING_API.md`,
  `docs/QUICK_START_SERVER_SIDE_CAPTURE.md`, `docs/STREAMING_MODE_TESTING.md`,
  commits `e94d12c` (disk-based removal), `f25b5b5` (streaming UI), PR #36/#38.

### A2 — "Why p5.js time lies when you record frame by frame" 🔵
- **Angle:** subtle but central problem — `millis()` no longer works under `noLoop()`.
  Solution: a global *recording mode* that computes time from the frame index
  (`window.enableRecordingMode()` / `disableRecordingMode()`), guaranteeing a
  perfectly closed loop.
- **Sources:** `docs/GLOBAL_RECORDING_API.md`, `src/templates/p5/utils/time.js`,
  commits `4ea4577`, `2373d98` (capture the right number of frames for a full loop).

### A3 — "Strategy pattern for recording: Realtime vs AsyncLoop" 🟡
- **Angle:** how a `BaseRecorder` abstraction + interchangeable strategies
  (`RealtimeRecorder`, `AsyncLoopRecorder`) + pluggable encoders (`MediabunnyEncoder`,
  `GifEncoder`) replaced a monolithic script. Codec negotiation
  (vp9→vp8→webm, avc1→mp4) with an `isTypeSupported` fallback.
- **Sources:** `src/engines/recording/` (BaseRecorder, strategies/, encoders/, types.ts),
  commit `b387bda` (refactor recording: lifecycle hardening), PR #50.

---

## 🧩 Architecture & refactoring

### B1 — "An asset system extensible by 'kind'" 🔵
- **Angle:** moving from hard-coded image handling to an extensible *registry*
  (`registry.ts` + `kinds/images`, `kinds/videos`); extraction into an
  engine-agnostic `@/lib/assets` lib reusable by both p5 **and** gsap.
- **Sources:** `src/lib/assets/`, commits `188466b`/`954162e` (lib extraction),
  `78566c2`/`dfd5e31` (kind registry), `146925a` (video assets), PR #53/#58/#59.

### B2 — "Unifying p5 utilities: anatomy of a utils/ folder that doesn't scare you" 🟡
- **Angle:** tour of `src/templates/p5/utils/` (animation, easing, grid,
  mappers, iterators, colors, converters, shapes, time…) and the `slides/` system
  (composable layouts: free, grid, polaroid, split, strip + `drawSlide*`).
  How to factorize without over-abstracting.
- **Sources:** `src/templates/p5/utils/`, `src/templates/p5/shared/`,
  `docs/REFACTORING_SUMMARY.md`, `docs/DEVELOPER_GUIDE.md`.

### B3 — "Reusable options: DRY on a generator's form fields" 🔵
- **Angle:** sketch options refactor — fonts & blend modes shared instead of
  redeclared in every sketch (−179 lines in a single commit). Options
  import/export, centralized field config.
- **Sources:** commit `abedc8c`/`abd206e` (PR #67), `docs/OPTIONS_IMPORT_EXPORT.md`,
  `src/components/.../ContentItems/constants/field-config.ts`.

### B5 — "A spatial hash for a grid alpha-mask: −510 lines, proven pixel-identical" 🔵
- **Angle:** perf **+** refactoring case study, ideal for a sharp technical article.
  - **Problem:** 8 sketches (`36days-of-type-2023`, `animated-text-points`) rebuilt
    a per-cell alpha field by reducing over **all** text-outline points for
    **every** cell → O(cells × points), ~**1M `dist()` calls/frame**. Helper
    copy-pasted into 2 diverging variants.
  - **Solution:** a single `gridMask.field()` that computes the field once per
    (grid, points, distance, mode), **caches** it, and accelerates it via a
    **uniform spatial hash** (bucket = distance, 3×3 neighborhood per cell).
  - **The article's selling point:** the fix is **proven pixel-identical** to the
    naive reduction — beyond `distance` a point always contributes the alpha floor (0)
    to the `max`, so skipping it never changes the result. A unit test verifies the
    identity (pixel/falloff, normalized/falloff, anisotropic normalized/boolean).
  - **Bonus:** `string.textPointsSignature()` to key caches on the same geometric
    signature as `getTextPoints`, `lerpField` morph helper, configurable gridMask
    radius, letter switching driven by loop progression.
- **Sources:** `src/templates/p5/utils/gridMask.js` (+ its test), commits `7931e41` (founding),
  `15517a9`/`dd745c9` (per-letter extension), `fc64f4b` (configurable radius),
  `8b70f7f` (loop-driven), PR #69. Directly answers the "gridmasks" topic.

### B6 — "A 'background' category: factoring out reusable background techniques" 🟡
- **Angle:** shared background-pattern util (fractional lines, full-height fix)
  + a new `background` category gathering reusable background techniques.
- **Sources:** commits `1661edd` (PR #78), `fc0a806`/`3527088` (PR #80).

### B4 — "The title & 'specs overlay' system" 🟡
- **Angle:** parametric rich title rendering (`utils/title/`) and an animated
  technical overlay displaying the sketch's settings (`drawSlideSpecs`, `specsData`).
- **Sources:** `src/templates/p5/utils/title/`, commits `6ee0393`, `bdce4ff` (PR #56).

---

## ⚡ Performance & optimization

### C1 — "Optimizing a gallery's LCP: WebP everywhere" 🔵
- **Angle:** thumbnail pipeline that emits WebP directly (extracting the video's
  first frame), responsive variants (thumbnail / thumbnail-2x /
  preview-md 540×675), caching, fallback. Measured LCP gains + a11y.
- **Sources:** `docs/THUMBNAIL_CACHING.md`, `docs/THUMBNAIL_CAPTURE_FIX.md`,
  `docs/THUMBNAIL_FALLBACK.md`, commits `bbf5981`/`fd04e80` (PR #30), `51dfd7b`, `954d92c`.

### C2 — "Guaranteeing target FPS in a p5 draw loop" 🔵
- **Angle:** FPS-halved bug caused by *animation chains* duplicated on
  pause/resume; clock desync when returning to the tab; RAF idled when hidden.
  Good render-loop debugging examples.
- **Sources:** commits `596edc6`/`088ad35` (PR #63), `2b3fa4b`/`6bc2a4e` (PR #62),
  `docs/TIMING_FIX.md`, `docs/TIMING_FIX_V2.md`.

### C3 — "A performant carousel: avoiding resize jank and clipped shadows" 🟡
- **Angle:** series of UI fixes on the gallery (horizontal per-category carousel,
  lazy previews, conditional toggle, end-of-scroll fade, smooth expand).
- **Sources:** commits `f68a330`/`b06f4d8` (PR #56/#57), `6f8ef98`, `4170258`, `c460483`.

---

## 🖥️ GPU / WebGL (new axis — 2026-06-08 scan)

### G1 — "Porting a Perlin noise grid to the GPU: instanced rendering + GLSL" 🔵
- **Angle:** the major perf story of this wave. The whole `noise-grid` family
  (CPU, one `dist()`/cell) is ported onto a **shared GLSL noise-field engine**
  with **instanced rendering** (a single draw call for thousands of cells).
  Faithful migration of v1, v2, v5, v6, v7, v8, v10, v11, v12 — keeping the
  rendering identical.
- **Concrete pitfalls to tell:** pinning `int` precision so the program links
  (`b154624`), renaming a GLSL variable that collided with the reserved word
  `packed` (`188d021`), clamping the eased weight to keep it bounded (`09d6236`).
- **Sources:** commits `f21ed8e` (shared GPU engine extraction), `1605cc2` (instanced
  renderer + v8), `f45c503`/`e32406b`/`56ae560` (v5/v6/v7/v8/v10/v12 ports), `a3ffca9`/`87d30f1`
  (v11 GPU, PR #71), `81d5178` (GPU easing fix v2/v6/v8/v12, PR #81).

### G2 — "Loading N sketches without bundling everything: a generated literal-import registry" 🔵
- **Angle:** load-time perf — instead of opaque dynamic imports, **generate** a
  registry of literal imports the bundler can analyze and code-split cleanly.
- **Sources:** commits `50e758e`/`7aa7947` (PR #82), cross-reference with the
  generation `scripts/`.

## 🎨 Creative templates ("making-of" angle)

### D1 — "The noise-grid family: 13 variations of the same noise field" 🟡
- **Angle:** creative case study — pulse, easing, holes, stick, rotation, field
  distortion… how one primitive (grid + Perlin noise) spawns a whole family.
- **Sources:** `src/templates/p5/sketches/noise-grid/`, commits `e31be6e` (PR #66),
  `df19572`, `9b0b125`.

### D2 — "Video templates: echo, halftone, kaleidoscope, text" 🟡
- **Angle:** treating a video asset as a p5 texture (graphics buffer, blend modes,
  anti-distortion object-fit, drag-to-position). Resilient video runtime.
- **Sources:** `src/templates/p5/sketches/video/`, `src/lib/assets/kinds/videos/`,
  commits `b458caf`, `3ef6ba6` (PR #65), `5a1f606` (buffered graphics), `146925a` (PR #59).

---

### D3 — "Smoothed splines: Chaikin corner-cutting on points" 🟡
- **Angle:** simple, visual creative algorithm — rounded curves through iterative
  corner cutting (Chaikin); new `splines` category, general size scale.
- **Sources:** commits `17f52d7`/`e8e828e` (PR #72), `9d706b5`, `src/templates/p5/sketches/splines/`.

### D4 — "Camera-driven splines: face capture as ordered groups" 🟡
- **Angle:** real-time interaction — vision/MediaPipe capturing face points as
  **ordered groups** to feed living splines; runtime vision activation.
- **Sources:** commits `aff6151`/`e7fcba3` (camera-driven splines), `d6b39f3`/`03c2bd1`
  (face capture ordered groups), `src/templates/p5/utils/mediapipe/`.

### D5 — "GSAP photo templates: Grid Cascade, Coverflow 3D, Stack Shuffle" 🟡
- **Angle:** the GSAP engine side (not p5) — 3 animated templates on a shared rich
  parameter base; capture trick: **embed images as data-URLs** when rasterizing
  for recording (`e68818e`).
- **Sources:** commits `53dcd7c`/`36089d3` (PR #73), `src/templates/gsap/sketches/`.

## 🛠️ Platform & tooling

### E1 — "PWA + push notifications for a creative generator" 🟡
- **Sources:** `docs/PWA_IMPLEMENTATION_SUMMARY.md`, `docs/PUSH_NOTIFICATIONS.md`,
  `docs/NOTIFICATION_SETUP.md`, `scripts/generate-vapid-keys.mjs`, commit `87e9263` (PR #52).

### E2 — "A progress system that mirrors a streaming pipeline" 🟡
- **Angle:** step-based progress bar recalibrated for the streaming pipeline
  (15/75/10), reusable component, progress SSE.
- **Sources:** `docs/PROGRESSION_STEPS_SYSTEM.md`, `docs/PROGRESS_BAR_COMPONENT.md`,
  `src/lib/progression/`, commit `f25b5b5`, `7dc17ff`.

### E3 — "Testing a visual generator: metadata regression + property-based" 🟡
- **Angle:** Jest suite verifying consistency between sketch metadata and the
  filesystem; property tests with `fast-check`; CI without ts-node via `jest.config.js`.
- **Sources:** `src/templates/__tests__/`, `src/utils/__tests__/`, commits `5a3d1cc` (PR #55),
  `a247bb8`, `d291370`, `docs/TESTING_GUIDE.md`.

### E4 — "Server-side capture as a job: BullMQ + Redis + headless Playwright" 🟡
- **Angle:** architecture of the render queue (workers, stalled job recovery, S3 upload).
- **Sources:** `docs/ARCHITECTURE.md`, `docs/STALLED_JOB_FIX.md`, `src/app/api/recordings/`,
  deps `bullmq` + `ioredis` + `@aws-sdk/client-s3`.

---

## 🧪 "Quick win" nuggets (short articles / TILs)

- **F1** — `noLoop()` + `redraw()`: driving a p5 animation frame by frame from Node. 🟡
- **F2** — Negotiating a video codec in the browser with `MediaRecorder.isTypeSupported`. 🟡
- **F3** — `object-fit` + transform to make a video preview impossible to distort (`99a5605`). 🟡
- **F4** — Idling a `requestAnimationFrame` when the tab is hidden (`6bc2a4e`). 🟡
- **F5** — Extracting a WebP thumbnail from a video's first frame (`51dfd7b`). 🟡
- **F6** — Tracking pageviews on client-side route changes in the Next.js App Router (GA4 without reloads) — `3eca276`/`2b82093` (PR #68), `src/components/GoogleAnalyticsTracker.tsx`, `src/lib/analytics/gtag.ts`. 🟡
- **F7** — When a color palette crashes the draw loop: the `rainbowCrazy` fix (`6b8966c`, PR #77). 🟡

---

## 🔭 Leads for the next scan

Things to watch in future commits for new articles:
- finalization of the in-browser Mediabunny encoder (does it replace FFmpeg?);
- cleanup of legacy libs (`tar.js`, `CCapture`) — closes the A1 series;
- **promising unmerged branches** spotted during the 2026-06-08 scan (to mine once on `main`):
  `ephemeral-pr-deployments` (Vercel preview + NAS → DevOps article), `shader-learning-p5js`
  (shaders course M0-M1 + playground), `p5.js v2` migration, `audio-instrument-recognition` (DSP);
- continuation of the GPU port (section G) → measured before/after numbers;
- new templates → feeds section D.
