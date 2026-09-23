# TODO — sketchbook

> Last cleaned: 2026-09-01, against `main` at 0e2fbce — items checked off
> against the current source, not from memory; each newly ticked line names
> what closed it.

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
- [x] **Sketch layout uses full window height** — the viewport is sized `calc(100% - top bar - transport - filmstrip - drawer)` in `SketchPage`, and the three fullscreen axes give it the whole surface when the chrome is hidden
- [x] **Lazy slide rendering** — only the active slide's sketch runs; the filmstrip shows the others as `SlideThumbnail`s
  - [x] Swap active sketch in/out without losing form state — slides stay in the RHF field array, only the rendered one is mounted
  - [x] Display other slides as page indicators or a static thumbnail strip
- [x] **Revamp slide carousel** — show current slide large in viewport, others as a horizontal strip of static thumbnails; non-active slides must not run the sketch
- [x] **Drag items on canvas** — pick up content items by position and update their x/y in form values in real time (decision: P5 events vs React overlay — see bug B4)
- [ ] **Copy / paste items** — duplicating *within* a slide is done (`duplicateItem` in `LayerGroup`: deep clone, `id` dropped, inserted right after the source, exposed as the layer row's Copy button; Delete/Backspace removes the open layer). What is missing is a real clipboard — Ctrl+C / Ctrl+V carrying an item **across slides and across sketches**, which needs a serialized payload and a paste-time check that the target sketch can host the item's type
- [ ] **Resize guide** — alignment snap lines / rulers overlay when resizing or moving items, implemented as a second canvas layer
- [ ] **Crop and rotate images on the fly** — in-canvas transform controls for image items; store params in item options, apply during render and frame capture

---

## 🧩 Template Engine

- [x] **Generic template engine handler** — shared abstract layer (location, screenshot, recorder, options, preview, job) that all engine types implement; common Pause / Stop / Record controls delegated to the active engine
- [x] **Meta to enable / disable a sketch** — boolean `enabled` field in template metadata; disabled sketches hidden from picker and cannot be recorded
- [ ] **Migrate old sketches** — audit legacy sketch files (pre-refactor, `canvasdefault0` refs, old option schemas) and port them to the current template format
- [x] **Enhance current sketch settings** — better grouping, collapsible sections, field tooltips, validation feedback (umbrella — file sub-tasks per specific UI issue)
- [x] **Component split — `CaptureActions`, `SketchSettings`** — both are folders now, split the TemplateOptions way: `CaptureActions/` has `hooks/useBrowserRecorder`, `useBrowserRecordingSupported`, `utils/`, and one component per job state (`NoJobActions`, `DraftActions`, `RecordingActions`, `CompletedActions`, `FailedActions`, `OptionsImportExport`); `SketchSettings/` sits at 327 lines beside `GenerateThumbnailButton`, `GeneratePreviewButton`, `SaveDefaultsButton`, `UiSoundSettingsButton` and `utils/createSketchFormConfigFromDefaults`
- [ ] **Component split, round 2** — the two named above are done, but the studio grew new heavyweights. Current >750-line non-generated files, at 0e2fbce: `ContentItems/constants/field-config.ts` (1918), `types/sketch.types.ts` (1693), `BindingAffordance.tsx` (1342), `gsap/utils/runtime.tsx` (1274), `SketchesList.tsx` (1077), `SlideTransitionSettings.tsx` (978), `SketchOptions.tsx` (917), `FieldRenderer.tsx` (906), `FormUndoRedo.tsx` (842), `CaptureActions/CaptureActions.tsx` (764 — the shell kept the orchestration). Same rule: hooks + small UI, no behaviour change per commit. They are still growing — `BindingAffordance.tsx` alone put on 185 lines between 6f4a204 and 0e2fbce
  - [ ] Drop the 7-line `components/CaptureActions.tsx` re-export shim: it duplicates `CaptureActions/index.ts`, and `CaptureDialog` already `dynamic()`-imports the folder
- [ ] **Unit tests** — cover form utilities, slide management logic, recording step calculations, thumbnail utils, and API route handlers; start with pure functions then hooks

---

## 🎛️ Options / Form System

- [ ] **FormValues / FormConfig architecture** — formalize the split between runtime state (`formValues`) and UI schema (`formConfig`); define clear TS types and ensure all sketch settings flow through this pattern
- [ ] **Sketch code utils** — extract shared P5 utilities (`getImages`, `getBg`, color helpers, noise helpers, etc.) into a shared module importable by all sketch templates
- [ ] **Common images handling** — define a standard `ImageInput` type and loader utility used by all sketches for loading, caching, and fallback
- [ ] **Migrate images-stack to multiple inputs** — replace the single multi-image array field with individual typed image inputs per slot, with per-slot drag-and-drop
- [x] **Item-list component** — `item-list` is a field type in `FieldRenderer`; it delegates each entry to the renderer for the configured item type (the breakdown item's `snapKeys` / `excludeKeys` are `item-list`s of `key-select`)
- [ ] **Options: button field type** — support a `button` type in the settings schema; clicking triggers a named callback in the sketch (e.g. Randomize, Reset, Capture frame)
- [ ] **Specialized input components**
  - [ ] Color / Palette — the named palette picker (iridescent, rainbow, purple, blue/yellow, B&W, gold) is still missing; `ControlledColorInput` already covers the colour + alpha half (draggable alpha bar over a checkerboard preview, numeric entry)
  - [ ] Noise — LOD detail, seed, noise type selector
  - [x] Easing — `ControlledEasingInput`, `easing` field type
  - [x] Vector (2D) — `ControlledVector2DInput` + `Vector2DPad`, `vector2d` field type (a 3D variant is still open, file it when a sketch needs one)
  - [ ] Camera — rotation and translate controls. The sketch side exists: `src/sketches/p5/utils/cameraRig.js` is a shared `camera` group (tilt, spin, distance, an eye offset and a target, every field a bindable slider; `sculpt-v4-sphere` uses it). What is left here is a dedicated control — a 3D pad or an on-canvas orbit gesture writing into that group
  - [ ] Global animation curve — waveform picker (sine, square, linear, triangle) + multiplier + speed. Interaction bindings already give any *single* sketch parameter a generator with a wave, speed and curve (`docs/memory/interaction-bindings.md`), so what is left here is the **global** one — one curve several fields follow — not a per-field wave
  - [x] Webcam picker — dropdown of available `videoDeviceId`s
  - [x] Joypad picker — list connected gamepads
  - [x] MIDI device picker — list connected MIDI inputs
  - [x] Audio source picker — microphone / line-in selector
  - [x] Reset / Random button — inline button per field to reset or randomize its value
  - [ ] Animation value visualizer — small sparkline showing an animated value over time. The drawing exists as the `hud-sparkline` content item, but it renders **on canvas**; this asks for the same trace inside the control, next to the field a binding is driving
- [ ] **Readonly mode** — `readOnly` prop on `TemplateOptions` that disables all fields; useful for share/embed views
- [ ] **Tags** — free-form labels on sketches and recordings; stored in DB, displayed as pills, filterable on recordings page
- [x] **Same line design** — `layout: "inline"` hint in field config so label and input render on the same row
- [x] **Collapsible groups without schema** — `SketchSettings/utils/createSketchFormConfigFromDefaults.ts` derives a `FieldConfig` tree from the sketch's plain defaults object (with optional per-path hints), and `GenericObjectForm` renders its nested groups as collapsible bands inside a `PanelSection` — the "lightweight auto-generated schema" route, not heuristic grouping

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
  - [ ] `useMidi` — WebMidi note/CC events (WebMidi.js already bundled). The *events* are handled: `interaction/index.js` keeps held notes and held control-change values, surfaced as the `midi` vector2d channel plus one `midi.cc<n>` scalar **minted per CC actually received** (there is no fixed cc1…cc8 set — that guess caught nothing on real hardware) and `midi.ccLast`. What is left here is the hook surface, if it is still wanted. See the MIDI controllers section below
  - [ ] `useAudio` — Web Audio API analyser data
  - [ ] `useOrbit` — 3D orbit camera controls
  - [ ] `usePerlinNoise` — seeded Perlin/Simplex noise with optional animated offset
- [x] **MIDI learn as a gesture** — the crosshair button beside the source picker: arm, move a control, it is assigned. A frame-to-frame diff of the channel snapshot (`observeForLearn` + `useChannelLearn`), so it learns a fader, an audio band or a hand gesture just as well as a knob; derived channels are excluded or a mirror like `midi.ccLast` wins every time. See `docs/memory/interaction-bindings.md`
- [ ] **MIDI monitor panel** — a debug surface listing the decoded messages, every CC number seen with its raw and normalised value, the notes held, and the channel snapshot the resolver actually gets. Mocked up in full (a published artifact, Sept 2026) and worth porting behind `INTERACTION_BINDINGS`: without it, "which CC is this knob" is unanswerable from inside the app. The mock-up is what produced the measured Launchkey map in the MIDI controllers section below — guided capture of the eight encoders and sixteen pads per port, a DAW-mode arm button and a JSON dump
- [ ] **Bind the exotic value types** — modulation covers number, 2D pad, boolean, select and colour (see `docs/memory/interaction-bindings.md`); the rest still has no `kind`
  - [ ] **Generators for the 2D pad** — it can only follow a live vector2d channel today (Orbit and Perlin noise animate without a device; everything else needs one). One generator per axis on a shared clock, with a phase offset, would give circles / figure-eights / drifts
  - [ ] **Easing** — an ordered list of easing keys, so it maps like the enum family
  - [ ] **Asset / image** — cycle a stack of assets; the value is a path, so the enum fold rule applies once the list is on the binding
  - [ ] **Text** — a list of strings to step through; decide first whether that is modulation or a content feature
  - [ ] **Widen the targets, not just the kinds** — bindings only address paths under `sketch` (`getSketchScope`), so a content item's position and the canvas/animation settings carry no pastille. Deliberate for now: capture determinism for size/framerate, and per-item scoping for content
- [ ] **Probe system** — expose the values a sketch computes inside `draw()` (a lerped radius, an eased position, a per-element progression) so the HUD / specs can display them and a binding can follow them. Design proposal, phases and the rejected options in `docs/probe-system.md`
  - [x] Phase 1 — `probe( name, value )` + per-instance registry + runtime→UI bridge, readable as a `probe:` source by the `hud-*` items (`p5/utils/probe.js`, `lib/probeBridge.ts`, `hud/sources.js`; the specs overlay does not list probes yet)
  - [x] Phase 1.5 — a "Probes" inspector card listing what the running sketch publishes (live value, write count; no sparkline yet), dev-actions gated; it is also the discovery UI for the pickers (`ProbesPanel`, `useLiveProbes`)
  - [ ] Layer probes — recorded per instance but not addressable from the host's HUD (`probe:<layerId>.<name>` needs a stable layer identity)
  - [ ] Instrument the rest of the catalogue as sketches are touched (`docs/memory/sketches.md` — every sketch written or edited gets its probes)
  - [ ] Phase 2 — probes as binding channels (capture-safe, unlike every other non-generator source), with a per-binding input range and a "learn" button
  - [ ] Phase 3 (hold) — `probe.each` array probes and indexed addressing, for staggering off a per-element progression; wait for a real sketch to need it
- [ ] **Fake mouse pointer** — custom cursor overlay on the canvas (circle or crosshair) that follows pointer; useful when the system cursor isn't visible in recordings
- [ ] **Switch webcam ID** — re-initialize `getUserMedia` with new `deviceId` without reloading the sketch when the user changes webcam in the picker

---

## 🎚️ MIDI controllers

Playing a sketch from hardware. The measured truth about the Launchkey, the
decisions and the traps live in `docs/memory/interaction-bindings.md`; this is
the task register. **Complexity** is the cost of the change, **Worth** whether
it earns that cost.

### Ground truth (measured on a Launchkey Mini MK3, not read off the manual)

Both ports are published permanently and **the port — not a mode — decides the
map**. The DAW port is silent until armed with `9F 0C 7F` (a plain Note On; no
SysEx, so no extra permission prompt). Disarm with `9F 0C 00`.

| | `… MIDI Port` | `… DAW Port` |
| --- | --- | --- |
| Encoders | CC 29, 79, 80, 104, 109, 108, 113, 112 (ch 1) | CC 21 → 28 (ch 16) |
| Pads, top / bottom | 40-43, 48-51 / 36-39, 44-47 | 96 → 103 / **112** → 119 (ch 1) |
| LEDs | untested | ch 1 static · ch 2 flash · ch 3 pulse |

`104` is a *round pad* the Mini MK3 does not have, which is why the DAW rows are
not contiguous. LED colour is an index into a **128-entry palette** carried by
velocity, never free RGB; the channel follows the pad LAYOUT (session vs drum).
**Flashing alternates between the colour already on the pad and the one in the
message** and follows a MIDI clock, so a lone channel-2 message looks erratic; a
lighting message on the static channel is also what stops a flash or a pulse.

### Shipped

| Feature | What it does | Why it matters | Complexity | Worth |
| --- | --- | --- | --- | --- |
| Control change parsing | `0xB0` kept in a Map, one `midi.cc<n>` channel minted per CC actually received | Without it a knob produces nothing at all | — | done |
| MIDI learn as a gesture | The crosshair beside the source picker: arm, move a control, it is assigned | Works on any hardware without a table | — | done |
| Port-keyed controller map | `interaction/controllerMap.js` resolves a port name + abstract control to a channel id | The same knob sends different CCs per port; the port is the only stable key | low | ✅ #360 |
| Control declared on a field | `binding: { control: "knob.1" }` in a sketch's `options.ts` | The sketch states intent, the app resolves the hardware | medium | ✅ #360 |
| Port name exposed to the engine | `getMidiDeviceName()`, empty while listening to every input | No map can apply without it, and an ambiguous name would address the wrong knob | low | ✅ #360 |
| Learn from the context menu | Right-click a field → "Learn a control…" → move it. A shortcut for assigning the source, not a second editor: easing, smoothing and generators stay in the popover | Four clicks down to two, on the one step that was tedious | low | ✅ #360 |
| Abstract control on a learned binding | The document keeps `knob.3`, not `midi.cc23` | The binding survives a MIDI ↔ DAW port switch, and would travel to another controller | low | ✅ #360 |

### Next

| Feature | What it does | Why it matters | Complexity | Worth |
| --- | --- | --- | --- | --- |
| Context menu on a checkbox | The checkbox branch of `FieldRenderer` returns before the wrapper carrying `onContextMenu`, so no boolean field has a context menu at all — and "Learn a control" is unreachable there although the `boolean` kind is bindable | A pad is the natural control for a toggle, and that is exactly the field it cannot be learned on | low, but it touches a branch every form shares | ⚠️ |
| MIDI output: arm / disarm DAW mode | Send `9F 0C 7F` on connect, `9F 0C 00` on teardown | Nothing in `src/` writes MIDI yet, and this gates the LEDs. Leaving the keyboard armed after the tab closes is the trap | medium | ✅ |
| Pad LEDs | Light a pad from the palette; flash and pulse | Visual feedback on the hardware itself | medium | ⚠️ comfort |
| `component: "action"` field type | A field that triggers rather than edits a value | **Pads cannot drive anything without it** — selecting an effect is an action, not a value. Already filed under Options / Form System | **high** | ✅ but its own job |

### Later

| Feature | What it does | Why it matters | Complexity | Worth |
| --- | --- | --- | --- | --- |
| **LFO as a declared control** | `control: "lfo"` resolves to a generator, not a channel | **The only `control` family that survives a headless capture** — every device source is silent in an export, a generator is a pure function of the loop clock. A parameter that breathes by default without breaking determinism | low | ✅ |
| Other control families | `axis.left-x`, `band.bass`, `pinch`, `tilt.x` | The vocabulary is already device-agnostic; each is a map entry, not a redesign | low each | ⚠️ on demand |
| Soft takeover for absolute pots | A knob stays inert until it crosses the stored value | Kills the jump when a bank switch re-points a knob. Only matters once banks exist | medium | ⚠️ if banks |
| Machine-level controller preference | Remember the port outside the document | "Open a sketch and it plays", without enabling MIDI inside every document | medium | ⚠️ |
| Pads driving actions | A pad selects or bypasses an effect | The performance gesture the whole thing is for; blocked on `component: "action"` | medium | ⚠️ after the action type |

### Rejected, and why

Keeping these so they are not re-proposed:

- **A `midi-slider` component kind** — here `component` describes the CONTROL, never a data source. It would have needed `midi-number`, `midi-color`, `midi-vector2d`… one per field type. A `binding` key on `BaseConfig` composes instead.
- **Alias channels** (`midi.knob1` mirroring `midi.cc21`) — a mirror moves exactly as much as its source, so it would need `derived: true`, which is the flag excluding a channel from MIDI learn. The alias would be unlearnable. The map resolves instead of minting.
- **Writing auto-wired bindings into the document** — one machine's CC numbers would reach the saved JSON, the export and `/embed`, the form would go dirty on every reconnect, and `mergeChangedInPlace` treats arrays as leaves so the next form push would wipe them anyway.
- **Inferring the port mode from traffic** — unnecessary: the port is deterministic, and the DAW port is simply silent until armed.
- **Fuzzy device-name matching** — "Launchkey" would claim an MK4 whose numbers nobody has measured. Exact, then case-insensitive, never a prefix.
- **A fixed `midi.cc1 … midi.cc8` set** — tried on `main` and caught nothing: the factory bank is neither contiguous nor in panel order.

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
- [ ] **Secure `.env`** — `.env.example` is tracked (ec49040) and no secret was ever committed (`git log --diff-filter=A -- '.env*'` is empty); what remains is documenting required vs optional per var and deciding on a secrets manager for production
- [x] **Notification settings corner (PWA)** — widget to manage push notification preferences (enable/disable, test notification, permission status); part of PWA install flow
- [ ] **Multi-user support** — user accounts with auth (email/password or OAuth); recordings and jobs scoped to `userId` in DB; API auth middleware; break into sub-tasks before starting

---

## 🔬 Loading & Asset System

- [ ] **Pending promises / asset loading system** — sketches must register asset loading promises; engine waits for all to resolve before starting draw loop and before frame capture begins
  - [x] Wait for images to load
  - [x] Wait for fonts to load
  - [x] Wait for audio assets to load
  - [x] Wait for video assets to load
  - [x] Support custom sketch-defined loading operations — `beginLoadingStep` / `reportAssetLoading`
  - [ ] Gate the draw loop / the engine `ready` event on the steps settling — needs a timeout + failure policy first, or one dead asset path hangs the sketch forever
- [x] **P5 loading steps reporting** — sketches report fine-grained loading progress in real time (n of N images, fonts, audio, video); the engine `loading` event feeds the sketch-page placeholder

---

## 🐛 Bugs

- [ ] **Save draft removes capture actions** — capture actions panel disappears or resets after saving a draft; should persist with its current state
- [x] **LocalStorage drift** — UI state (collapsed sections, view mode) stored in `localStorage` can fall out of sync with DB state; audit and add reconciliation on load — answered for the options panel by only persisting schema-shaped keys (`docs/memory/studio-ui.md`); content-shaped ones (`conditional-<path>`, which addresses an item by index) are never stored, so there is nothing to reconcile
- [x] **Keep sketch options open with same collapsibles** — collapsible sections reset to default on navigation; persist open/closed state per-sketch in `localStorage` or URL hash
- [x] **Drag items — decision pending** — item drag on canvas is partially implemented but inconsistent; must decide between P5 events vs React overlay before more work
- [ ] **useAudio / MIDI not working — re-test, the surface moved** — the `useAudio` / `useMidi` hooks this was filed against no longer exist. Audio and MIDI now arrive as interaction channels (`audio.level` plus the six bands off `getAudio().bands`, `midi.cc`, …) consumed by bindings and by `@/p5/utils/interaction`. Re-test *there*, behind `INTERACTION_BINDINGS=true`, and re-file against the channel if the signal is dead; the original suspicion (missing user-gesture unlock for Web Audio / WebMidi) is still the first thing to check
- [x] **Apply sketch options to other slides** — "apply to all slides" action shallow-copies nested objects and drops nested keys; fix the deep-merge logic
- [ ] **Fix clone features — assets ignored** — cloning a recording does not copy uploaded assets to the new job; new job silently uses stale/inaccessible paths
- [ ] **Prevent too much image fetch** — thumbnails and asset images are re-fetched on every render in some cases; add caching headers and/or a client-side URL cache
