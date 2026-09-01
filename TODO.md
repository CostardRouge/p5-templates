# TODO — sketchbook

> Last cleaned: 2026-07-19

---

## 🏷️ Rename follow-ups (owner-only actions)

The codebase is renamed to **Sketchbook** (`sketch` = the unit, `preset` = a saved
configuration, `/sketches` = the gallery, with permanent redirects from `/templates`).
What's left requires actions only the repo owner can take, in this order:

- [ ] **Rename the GitHub repo** `CostardRouge/p5-templates` → `CostardRouge/sketchbook`
  (GitHub redirects the old URL automatically). Then update `GITHUB_URL` in
  `src/components/HomePage.tsx` and `NEXT_PUBLIC_GITHUB_REPO_URL` in deploy env.
- [ ] **GHCR image** — after the repo rename, CI publishes under the new path; update
  `docker-compose.yml` default (`APP_IMAGE`), `deploy/README.md`, and the
  Watchtower `DEPLOY_WEBHOOK_URL`. Old `ghcr.io/costardrouge/p5-templates` packages
  stay pullable but stop receiving tags.
- [ ] **VAPID subject** — set `VAPID_SUBJECT=mailto:<real address>` in deploy env
  (code falls back to the historical `admin@social-templates.com`).
- [ ] Optional cleanup once old clients are gone: drop the `template` fallbacks
  (enqueue form field, media response alias, localStorage/sessionStorage legacy keys).

---

## 🎬 Recording System

- [ ] **Batch recordings** — queue multiple template+options combinations in a single action; needs UI (select multiple drafts → start all) and backend atomic/sequential enqueue
- [ ] **Different output sizes** — produce multiple aspect ratios (1:1, 9:16, 4:5) from a single job; add size-preset list at job level and loop over them in the worker
- [ ] **See all recordings for a template** — filter/view on the recordings page scoped to a template slug; link from template card or `?template=xxx` query param
- [ ] **Ability to name a recording** — human-readable label stored in DB, displayed in list and preview modal; text input in capture actions or draft creation flow
- [ ] **Fix clone — assets not copied** — cloned job references original S3 asset paths; copy assets to a new prefix keyed to the new job ID during the clone API call
- [ ] **Fix stale jobs** — jobs stuck in `active`/`queued` after worker crash; detect by missing progress update, add force-restart endpoint, surface UI button
  - [ ] Force Redis queue flush (admin/CLI, protected)
  - [ ] Force start a specific stale job (admin action, re-dispatch to worker)
- [ ] **Prevent re-submitting the same assets** — compare by hash or existing S3 key before uploading; skip upload if already present
- [x] **Fix recording step coherence** — steps (launching browser → capturing → saving → encoding) sometimes appear out of order; audit worker SSE emissions, clearly show slide #/total per step

---

## 🖼️ Sketch / Canvas

- [x] **Sketch duration control** — top-level global duration field (per-slide values override it); needs UI input and schema update
- [x] **Full screen button** — Fullscreen API toggle on the canvas viewport; must account for scalable viewport dimensions on resize
- [x] **Sketch preview page** — `/sketch/:id/preview` route showing canvas only (no settings, no header); accept query params to override options
- [ ] **Sketch layout uses full window height** — fix flex/grid so canvas fills all available vertical space on desktop
- [ ] **Lazy slide rendering** — only the active slide's P5 sketch runs; inactive slides show their saved thumbnail to save memory and CPU
  - [ ] Swap active sketch in/out without losing form state
  - [ ] Display other slides as page indicators or a static thumbnail strip
- [x] **Revamp slide carousel** — show current slide large in viewport, others as a horizontal strip of static thumbnails; non-active slides must not run the sketch
- [x] **Drag items on canvas** — pick up content items by position and update their x/y in form values in real time (decision: P5 events vs React overlay — see bug B4)
- [ ] **Copy / paste items** — Ctrl+C / Ctrl+V to deep-clone a selected item and append it to the slide's content array
- [ ] **Resize guide** — alignment snap lines / rulers overlay when resizing or moving items, implemented as a second canvas layer
- [ ] **Crop and rotate images on the fly** — in-canvas transform controls for image items; store params in item options, apply during render and frame capture

---

## 🧩 Template Engine

- [x] **Generic template engine handler** — shared abstract layer (location, screenshot, recorder, options, preview, job) that all engine types implement; common Pause / Stop / Record controls delegated to the active engine
- [x] **Meta to enable / disable a sketch** — boolean `enabled` field in template metadata; disabled sketches hidden from picker and cannot be recorded
- [ ] **Migrate old sketches** — audit legacy sketch files (pre-refactor, `canvasdefault0` refs, old option schemas) and port them to the current template format
- [x] **Enhance current sketch settings** — better grouping, collapsible sections, field tooltips, validation feedback (umbrella — file sub-tasks per specific UI issue)
- [ ] **Component split** — identify remaining large components (>300 lines), split following the TemplateOptions pattern (hooks + small UI); priority: `CaptureActions`, `SketchSettings`
- [ ] **Unit tests** — cover form utilities, slide management logic, recording step calculations, thumbnail utils, and API route handlers; start with pure functions then hooks

---

## 🎛️ Options / Form System

- [ ] **FormValues / FormConfig architecture** — formalize the split between runtime state (`formValues`) and UI schema (`formConfig`); define clear TS types and ensure all sketch settings flow through this pattern
- [ ] **Sketch code utils** — extract shared P5 utilities (`getImages`, `getBg`, color helpers, noise helpers, etc.) into a shared module importable by all sketch templates
- [ ] **Common images handling** — define a standard `ImageInput` type and loader utility used by all sketches for loading, caching, and fallback
- [ ] **Migrate images-stack to multiple inputs** — replace the single multi-image array field with individual typed image inputs per slot, with per-slot drag-and-drop
- [ ] **Item-list component** — reusable ordered-array component (add / remove / reorder via drag-and-drop) that delegates each item's config to the appropriate field renderer
- [ ] **Options: button field type** — support a `button` type in the settings schema; clicking triggers a named callback in the sketch (e.g. Randomize, Reset, Capture frame)
- [ ] **Specialized input components**
  - [ ] Color / Palette — palette picker (iridescent, rainbow, purple, blue/yellow, B&W, gold) + opacity slider
  - [ ] Noise — LOD detail, seed, noise type selector
  - [ ] Easing — curve preset picker + custom bezier editor
  - [ ] Vector (2D / 3D) — XY(Z) number inputs with optional linked scaling
  - [ ] Camera — rotation and translate controls
  - [ ] Global animation curve — waveform picker (sine, square, linear, triangle) + multiplier + speed
  - [x] Webcam picker — dropdown of available `videoDeviceId`s
  - [x] Joypad picker — list connected gamepads
  - [x] MIDI device picker — list connected MIDI inputs
  - [x] Audio source picker — microphone / line-in selector
  - [x] Reset / Random button — inline button per field to reset or randomize its value
  - [ ] Animation value visualizer — small sparkline showing an animated value over time
- [ ] **Readonly mode** — `readOnly` prop on `TemplateOptions` that disables all fields; useful for share/embed views
- [ ] **Tags** — free-form labels on sketches and recordings; stored in DB, displayed as pills, filterable on recordings page
- [x] **Same line design** — `layout: "inline"` hint in field config so label and input render on the same row
- [ ] **Collapsible groups without schema** — make collapsible sections work in sketch settings (which have no explicit schema) via heuristic grouping or a lightweight auto-generated schema

---

## 🎮 Input / Interaction

- [ ] **MediaPipe settings panel** — webcam picker, flip X/Y toggle, show/hide feedback overlay; accessible from sketch settings when a MediaPipe sketch is active
- [ ] **Capture hooks**
  - [ ] `useHandsCapture` — hand landmark positions from MediaPipe
  - [ ] `useFaceCapture` — face mesh / expression data
  - [ ] `usePoseCapture` — full-body pose landmarks
  - [ ] `useMouseCapture` — fix true canvas coordinates (apply inverse scale transform so `mouseX`/`mouseY` match canvas space, not CSS pixels)
  - [ ] `useAudioCapture` — FFT / amplitude data from microphone
- [ ] **Input hooks**
  - [ ] `useTouch` — normalized multi-touch points
  - [ ] `useHands` — high-level hand state from MediaPipe
  - [ ] `useFace` — high-level face state
  - [ ] `useBody` — full-body pose state
  - [ ] `useMidi` — WebMidi note/CC events (WebMidi.js already bundled)
  - [ ] `useAudio` — Web Audio API analyser data
  - [ ] `useOrbit` — 3D orbit camera controls
  - [ ] `usePerlinNoise` — seeded Perlin/Simplex noise with optional animated offset
- [ ] **Fake mouse pointer** — custom cursor overlay on the canvas (circle or crosshair) that follows pointer; useful when the system cursor isn't visible in recordings
- [ ] **Switch webcam ID** — re-initialize `getUserMedia` with new `deviceId` without reloading the sketch when the user changes webcam in the picker

---

## 🔌 Integrations & Automations

- [ ] **N8n integration** — webhook trigger so recordings can be kicked off from N8n; needs API key auth on `POST /api/recordings/enqueue` and payload docs for N8n's HTTP node
- [ ] **API cleanup + OpenAPI** — consistent error formats, Zod input validation, remove dead endpoints, auto-generate OpenAPI 3.0 spec
- [ ] **P5 → backend data push** — allow a sketch to push structured output during/after recording: an image (final frame as PNG) or a JSON object (metrics, generated text); feeds automations
- [x] **Sharable sketch link** — public URL with options baked in (compressed query param or short-code resolving to saved options); viewer sees sketch in readonly mode

---

## 🏗️ Rendering Engines

- [ ] **P5 v2 support** — evaluate migration to P5.js v2; audit breaking API changes and update all templates
- [ ] **HTML template engine** — plain HTML/CSS/JS templates as a first-class engine type; same `TemplateOptions` / `CaptureActions` flow, rendered in iframe or headless browser
- [x] **GSAP integration** — optional GSAP animation library for templates; `useGsap` hook providing a timeline synced to the recording frame clock
- [ ] **Lottie support** — load and play Lottie JSON animations frame-by-frame in sync with recording; `LottieLayer` component or P5 utility
- [ ] **Animated HTML templates** — templates built with HTML + CSS animations (or GSAP/Lottie) recorded the same way as P5 sketches; requires generic engine handler first
- [ ] **Cavalry integration** — research spike: can Cavalry export to a web-renderable format the engine can consume?
- [ ] **Code editor** — embed Monaco in the sketch page for live template editing; changes hot-reload the sketch; draft / save / version controls needed

---

## 🎨 Design & UX

- [x] **Animated thumbnail on hover** — play a short looping preview clip (GIF or MP4) on card hover; pre-generate and store alongside the static thumbnail
- [x] **New navigation bar** — redesign top bar: slim, logo + nav links + settings icon; mobile-friendly (collapses to hamburger or bottom nav)
- [x] **Sketch settings design** — visual redesign of the sketch settings panel (consistent typography, spacing, control styles)
- [x] **Templates options design** — same redesign for the right-hand template options panel
- [x] **Recording progress bar placeholder** — styled "waiting" state for cards in `queued` status with no steps yet (replace blank/misaligned bar)
- [x] **Remove bare loading text** — replace all "Loading…" text placeholders with skeleton loaders or spinners that match surrounding UI

---

## ⚙️ Infrastructure & DevOps

- [ ] **Sentry error tracking** — frontend (error boundaries + unhandled rejections) and backend (API routes + BullMQ worker); source maps uploaded in CI
- [ ] **Secure `.env`** — audit all env vars, ensure no secrets committed, add `.env.example`, document required vs optional; consider secrets manager for production
- [x] **Notification settings corner (PWA)** — widget to manage push notification preferences (enable/disable, test notification, permission status); part of PWA install flow
- [ ] **Multi-user support** — user accounts with auth (email/password or OAuth); recordings and jobs scoped to `userId` in DB; API auth middleware; break into sub-tasks before starting

---

## 🔬 Loading & Asset System

- [ ] **Pending promises / asset loading system** — sketches must register asset loading promises; engine waits for all to resolve before starting draw loop and before frame capture begins
  - [ ] Wait for images to load
  - [ ] Wait for fonts to load
  - [ ] Wait for audio assets to load
  - [ ] Wait for video assets to load
  - [ ] Support custom sketch-defined loading operations
- [ ] **P5 loading steps reporting** — sketches report fine-grained loading progress in real time (n of N images, fonts, audio, video); feeds the progress bar and prevents premature "ready" signal

---

## 🐛 Bugs

- [ ] **Save draft removes capture actions** — capture actions panel disappears or resets after saving a draft; should persist with its current state
- [x] **LocalStorage drift** — UI state (collapsed sections, view mode) stored in `localStorage` can fall out of sync with DB state; audit and add reconciliation on load — answered for the options panel by only persisting schema-shaped keys (`docs/memory/studio-ui.md`); content-shaped ones (`conditional-<path>`, which addresses an item by index) are never stored, so there is nothing to reconcile
- [x] **Keep sketch options open with same collapsibles** — collapsible sections reset to default on navigation; persist open/closed state per-sketch in `localStorage` or URL hash
- [x] **Drag items — decision pending** — item drag on canvas is partially implemented but inconsistent; must decide between P5 events vs React overlay before more work
- [ ] **useAudio / MIDI not working** — audio and MIDI hooks are wired but non-functional; likely async init order issue or missing user-gesture unlock for Web Audio / WebMidi
- [x] **Apply sketch options to other slides** — "apply to all slides" action shallow-copies nested objects and drops nested keys; fix the deep-merge logic
- [ ] **Fix clone features — assets ignored** — cloning a recording does not copy uploaded assets to the new job; new job silently uses stale/inaccessible paths
- [ ] **Prevent too much image fetch** — thumbnails and asset images are re-fetched on every render in some cases; add caching headers and/or a client-side URL cache
