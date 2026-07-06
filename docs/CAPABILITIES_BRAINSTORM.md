# Capabilities Brainstorm

A forward-looking menu of *capability bets* for `p5-templates` — where the product
could grow next, grounded in what the codebase already is.

**How this relates to `TODO.md`:** `TODO.md` is the granular, task-level backlog
(source of truth for "what's queued"). This doc sits one level up — it groups the
opportunities into themes, calls out the highest-leverage bets, and explains *why each
one fits the architecture we already paid for*. Where an idea overlaps an existing TODO
item, it's noted. Effort tags are rough: **S** = days, **M** = a week or two, **L** = a
multi-week arc.

---

## Where we are today

- **Engine-agnostic core** (`src/engines/types.ts`) with three engines registered — but
  only **p5 is mature** (267 sketches). GSAP (2 real sketches) and Three.js (1) are
  skeletal despite sharing the full recording + form contract.
- **Two recording pipelines**: client (webm/gif/mp4 + optional audio, via
  `mediabunny`/`gif.js`) and server (Playwright → ffmpeg, **mp4 only**).
- **A typed, discriminated-union form system** — every sketch declares `formValues` +
  `formConfiguration`. This is effectively a per-sketch JSON schema, and it's the single
  most under-exploited asset in the repo (see AI, below).
- **Rich interaction bindings** (12 vector sources + audio/gesture scalars) — but they
  live under `src/templates/p5/utils/`, so they're **p5-only**.
- **Single-tenant persistence**: `Template → TemplateSnapshot → Job`. **No user, auth,
  sharing, or collaboration** models exist.

The three biggest bets below each turn one of those facts into a product surface.

---

## 🎯 The three biggest bets

### 1. An AI/LLM layer over the form schema
There is **zero AI in the codebase today**, yet every sketch already publishes a typed
parameter schema (`formConfiguration`) and we already capture frames as base64 PNG
(`captureFrame`). That's the exact shape a modern LLM tool-use / structured-output loop
wants. Concrete surfaces:

- **Natural language → parameters.** "Make it darker, slower, three slides about summer
  sale" → an LLM emits a validated patch against the sketch's `formValues`. The
  `formConfiguration` *is* the tool schema; the Zod validators are the guardrail.
- **Describe-the-vibe → pick a template.** With 267 sketches + `metadata.json`, an LLM
  can select the right sketch *and* seed its options from a one-line brief.
- **Vision-in-the-loop refinement.** Render a frame → send the PNG to a vision model →
  "increase contrast, recenter the title" → apply another param patch → re-render. A
  closed critique loop, built entirely on `captureFrame` + `updateOptions`.
- **AI copy + palettes.** Auto-generate title/caption text per platform, and derive
  palettes from an uploaded image (`sharp` + `exifreader` are already installed).

*Why it fits:* the typed schema means the model outputs *validated data*, not free text —
low hallucination surface, deterministic apply. **Effort: M** for NL→params (one endpoint
+ a chat panel), **L** for the vision loop. Highest wow-per-effort in the repo.

### 2. Render-as-a-service: data → video at scale
The `Snapshot → Job → BullMQ → S3` chain is already a headless render farm with a UI
bolted on. Expose it as an API and it becomes an automation product (TODO already points
here: *N8n integration*, *API cleanup + OpenAPI*, *batch recordings*).

- **Public REST + OpenAPI + API keys** on `POST /api/recordings/enqueue`. (TODO)
- **Batch / matrix export.** One template + a CSV/JSON/Sheet of rows → N personalized
  videos ("500 name-tagged clips", "one card per product"). This is the killer B2B use of
  a parametric renderer.
- **Data-bound fields.** Bind a form field to a live source (Sheet, API, RSS) so content
  auto-populates — "today's stats/weather/standings" visuals.
- **Scheduled / recurring renders** (cron) → the missing "content engine" piece; pairs
  naturally with the webhook/N8n work.

*Why it fits:* no new rendering code — it's an API + fan-out over the existing job model.
**Effort: M** for the API + keys, **M–L** for batch/data-binding.

### 3. Social-native output presets
We're a *social* templates tool that currently exports a single mp4 at one size. The
highest-value, most contained win:

- **Multi-aspect auto-reframe.** One options set → 1:1, 9:16, 16:9, 4:5 in one job (TODO:
  *different output sizes / aspect ratios*). Requires a "safe-area" concept in sketches.
- **Transparent / alpha output.** WebM VP9-alpha, ProRes 4444, or PNG sequence — so a
  sketch can be an *overlay* in CapCut/Premiere/After Effects. Big unlock for motion
  designers; the server path is mp4-only today.
- **Format & quality expansion on the server:** GIF/APNG/WebP, HEVC, configurable
  CRF/bitrate, audio loudness normalization.

*Why it fits:* the capture layer is format-agnostic already (client does 3 formats); this
is mostly encoder plumbing + a reframe abstraction. **Effort: S–M** per format.

---

## The full menu, by theme

### 4. Make the engine abstraction actually pay off
We built a clean `SketchEngine` interface and then only populated p5. Options:

- **Lift interaction bindings into the engine-agnostic layer.** Today webcam/audio/gesture
  modulation is trapped in `src/templates/p5/utils/`. Moved up, GSAP and Three.js sketches
  get reactive params for free. **Effort: M.**
- **Flesh out Three.js** (3D kinetic type, particle fields, GLSL scenes) and **GSAP/DOM**
  (kinetic typography, HTML/CSS social cards). The contract already supports recording +
  forms. **Effort: L, incremental.**
- **A first-class shader sketch type.** A GLSL-fragment template where `uniform`
  declarations auto-map to form fields (Shadertoy-style, but parameterized + recordable).
  Very high visual ceiling for low code. **Effort: M.**
- **Lottie and pure-HTML engines** (both in TODO) — cheap, crisp, text-heavy templates
  that don't need a canvas.

### 5. Distribution: sharing, embedding, accounts
The whole app is single-tenant with no way to share out. This is the platform gap.

- **Read-only shareable links** with baked-in options + a public viewer (TODO:
  *sharable sketch link* / *readonly mode*). Smallest step, biggest reach. **Effort: M.**
- **Embeddable iframe / oEmbed** — drop a *live, parametric* sketch onto any page or
  Notion/blog. Differentiates from "export a file" tools. **Effort: M.**
- **User accounts + per-user scoping** (TODO: *multi-user support*) — the prerequisite for
  everything below and for a hosted offering. **Effort: L.**
- **Template gallery / marketplace** — publish sketches + presets, remix others'. Turns a
  personal library into a community. **Effort: L.**
- **Real-time co-editing of a template's options** (multiplayer params). Ambitious, but
  the options object is small and diff-friendly. **Effort: L.**

### 6. Authoring & editor UX
Deepen the creative tool for people who live in it.

- **Timeline / keyframe editor.** Animate *any* param across the loop with a curve editor.
  We already have `easing` fields and slide-to-slide morphing — this generalizes it into
  real keyframing. **Effort: L.** High impact for power users.
- **On-canvas direct manipulation** — drag/resize/rotate/snap items instead of typing
  numbers (TODO: *drag items*, *resize/snap guides*, *crop/rotate*). **Effort: M–L.**
- **Preset & variation browser.** Save named presets per template; "randomize seed";
  render a **contact sheet** of N variations as thumbnails to pick from. Pairs beautifully
  with the batch renderer and with AI. **Effort: S–M.**
- **Brand kits.** Reusable palette + logo + font sets applied across any template
  (missing entirely today). The feature agencies/creators ask for first. **Effort: M.**
- **Embedded Monaco editor** (TODO) — live-edit sketch code with hot reload; a natural
  home for AI-assisted sketch scaffolding.

### 7. Audio & reactivity (beyond live)
Live audio bindings exist; the offline/deterministic side is open.

- **Upload-a-track → auto music video.** Offline beat/onset/spectral analysis drives
  params deterministically, then renders a synced visualizer. Today reactivity is realtime
  only; deterministic capture of audio-reactive sketches is the missing half. **Effort: M.**
- **Waveform / spectrogram sketch primitives** + a TTS voiceover track layered into the
  montage (a text-to-speech MCP is available in this workspace).

### 8. Ops, quality & trust
Less glamorous, but gates the "hosted product" step (all flagged in `ARCHITECTURE.md` as
recommended-not-built):

- **Rate limiting + API auth** before any public API ships.
- **Observability**: queue length, avg render time, success/fail rates (Sentry is in
  TODO). Renders fail in interesting ways; you'll want the metrics.
- **Asset dedup by hash** (TODO) + stale-job recovery hardening.
- **A visual-regression harness** for sketches — deterministic capture means you can
  snapshot-diff a frame per sketch in CI and catch "I broke 40 templates" before shipping.

---

## If I had to sequence it

1. **NL → params (AI)** — fastest path to a "wow", leverages the schema we already have.
2. **Multi-aspect + alpha output** — contained, directly serves the social mission.
3. **Read-only share links + embeds** — unlocks distribution with no auth dependency.
4. **Render API + batch/data-driven** — turns the tool into a platform.
5. **Accounts, then marketplace / collab** — the platform build-out.

Threaded throughout: **lift interaction bindings to the engine layer** and **grow
three.js/GSAP/shader templates**, so the abstraction we built starts earning its keep.
