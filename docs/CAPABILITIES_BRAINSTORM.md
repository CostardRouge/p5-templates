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

## North star: a zero-install, client-side creator tool

The direction is **not** a hosted render farm. Front-end recording already works very
well — mp4, webm + audio, and it records on a phone — to the point where backend
recording is barely needed day-to-day. The ambition is for **followers/users to use the
front-end recording directly**: tap a link, tweak a visual, record, post — with **no
Docker / Redis / Postgres / install**. The heavy backend (BullMQ + Playwright + S3) stays
as the *owner's* private power tool; the **product is the client-side loop**.

Everything below is filtered through that lens. Server-side "render-as-a-service" is
explicitly deprioritized (see the end).

### Where we are today
- **Front-end recording is the mature, mobile-capable path** — `RealtimeRecorder` +
  `AsyncLoopRecorder` producing webm/gif/mp4 (+ optional audio) via `mediabunny`/`gif.js`,
  all client-side. This already runs on a phone.
- **Rich interaction bindings** (12 vector sources + audio/gesture scalars: webcam, hands,
  face, body, mic, orbit, noise, gyroscope, MIDI, joypad) — but they live under
  `src/templates/p5/utils/`, so they're **p5-only** today.
- **A typed, discriminated-union form system** — every sketch declares `formValues` +
  `formConfiguration` (effectively a per-sketch JSON schema). Under-exploited.
- **Single-tenant persistence** (`Template → TemplateSnapshot → Job`) and a PWA baseline
  already exist — but the core create→record→export loop does **not fundamentally need
  the database** to run.

---

## 🎯 The three biggest bets

### 1. The viral loop: URL-encoded share + remix links
This is *the* feature for a creator audience, and it needs **no backend**. Encode a
sketch + its options into a shareable URL (already sketched in TODO: *sharable sketch
link with baked-in options* / *readonly mode*).

- `/t/p5/<sketch>?o=<encoded-options>` opens **exactly** what you made — on a phone, with
  no account and no server call. Options live in the URL (and/or `localStorage`).
- Follower opens → tweaks → records → downloads → posts *their* version. Put the link in
  the TikTok bio / video description and the loop closes.
- Every export offers a **"remix this"** link back to the template, so viewers become
  makers. This is what turns "cool videos on your feed" into "your followers making
  videos with your tool."
- Keep assets client-side for the zero-install path (object URLs / IndexedDB), so an
  uploaded image never needs S3.

*Why it fits:* it's a serializer + a public viewer route over state we already hold in the
client. **Effort: M.** Highest strategic value for the stated goal.

### 2. Ship it as a zero-install, mobile-native experience
Make "no install" literally true and make the phone experience feel native.

- **Deploy the client to the edge (e.g. Vercel).** The create→tweak→record→export path is
  all client-side, so it can be a public URL with the heavy backend staying local/optional.
  Feature-detect the backend: if absent, hide the recordings dashboard + backend-record
  button, keep everything else.
- **Lean into the PWA** (`PWA_*` docs already exist). "Add to Home Screen" → app-like on a
  phone with zero App Store friction. This *is* the distribution story.
- **Mobile-first editing, not just recording.** Recording works on phone; *tweaking a form
  of number fields with a thumb* does not. Wins: on-canvas drag/pinch instead of typing
  (TODO: *drag items*, *resize/snap*), a curated **"quick controls"** set per template
  (3–5 params, not 30), bottom-sheet UI, big touch targets.
- **Vertical-first.** Default to **9:16** and a one-tap "export for TikTok".

*Why it fits:* mostly UX + deployment work over an already-client-side loop. **Effort:
M–L**, incremental.

### 3. Interaction bindings as the content hook
The webcam/hand/face/audio-reactive bindings are secretly the best TikTok asset in the
repo: "point your camera / wave your hand / it reacts to the music" is *inherently*
shareable, it's client-side, and `RealtimeRecorder` already records the live performance.

- Elevate reactive templates as the **flagship demos** — record a hand- or audio-driven
  sketch on a phone and post it.
- **Audio-reactive to trending sounds** — a natural fit for the platform.
- Longer arc: **lift the bindings out of `p5/utils` into the engine-agnostic layer** so
  GSAP/Three.js sketches get the same reactivity (see §4).

*Why it fits:* the capability already exists and already records; this is
productization + curation, not new infra. **Effort: S** to feature them, **M** to lift
them cross-engine.

> ⚠️ **The assumption all three rest on: cross-device support.** "Works on everyone's
> phone" lives or dies on **iOS Safari** — MediaRecorder/WebCodecs (mp4/webm) and
> MediaPipe hand/face tracking are both historically finicky there. It works on *our*
> phone; validate it works on *followers'* phones **before** building the share loop on
> top of it. This is the load-bearing test.

---

## The full menu, by theme

### 4. Make the engine abstraction pay off (client-side)
We built a clean `SketchEngine` interface and only populated p5 (267 sketches vs. GSAP's
2, Three.js's 1). All of this is client-side and serves the zero-install goal.

- **Lift interaction bindings into the engine-agnostic layer.** Today reactivity is
  trapped in `src/templates/p5/utils/`. Moved up, GSAP + Three.js sketches get
  webcam/audio/gesture modulation for free. **Effort: M.**
- **A first-class GLSL-shader sketch type** where `uniform` declarations auto-map to form
  fields (Shadertoy-style, but parameterized + recordable). Huge visual ceiling, low code,
  great on GPU-capable phones. **Effort: M.**
- **Grow Three.js / GSAP / Lottie / HTML templates** (all in TODO) — the recording + form
  contract already supports them. **Effort: L, incremental.**

### 5. AI, but client-friendly
Still the "wow" feature — and it does **not** need the render farm.

- **Natural language → validated param patch.** "Darker, slower, 3 slides about X" → a
  patch against the sketch's `formValues`. The `formConfiguration` *is* the tool schema;
  the Zod validators are the guardrail, so the model emits *validated data*, not free text.
  One serverless/edge route (or bring-your-own-key). **Effort: M.**
- **Describe-the-vibe → pick a template** from the 267 sketches + `metadata.json`.
- **Vision-in-the-loop** (later): render a frame → vision model critiques → apply another
  patch → re-render. Built on the existing `captureFrame` + `updateOptions`. **Effort: L.**

### 6. Social-native output (all client-side)
- **Multi-aspect export** — 9:16 / 1:1 / 4:5 / 16:9 from one options set (TODO: *different
  output sizes*). Needs a "safe-area" concept in sketches. **Effort: M.**
- **Format & quality choices** the client codec supports (webm-alpha where available,
  bitrate/quality), plus GIF for quick loops. **Effort: S.**
- **One-tap platform presets** (TikTok 9:16, Reels, Shorts) with sensible durations.

### 7. Authoring & editor UX
- **Preset & variation browser** — save named presets per template; "randomize seed";
  a **contact sheet** of N variations to pick from. Pairs with AI + the share loop, and
  gives followers instant novelty. **Effort: S–M.**
- **Brand kits** — reusable palette + logo + font sets applied across templates (missing
  entirely today). **Effort: M.**
- **Timeline / keyframe editor** — animate *any* param across the loop with a curve editor;
  generalizes the existing easing fields + slide-morphing into real keyframing. **Effort:
  L.** Power-user depth.

### 8. Audio & reactivity (beyond live)
- **Upload-a-track → auto music video.** Offline beat/onset/spectral analysis drives params
  deterministically, then records a synced visualizer — the deterministic half of the
  audio-reactive story that's currently realtime-only. **Effort: M.**

### 9. Distribution & light social layer (optional, later)
Only if/when the zero-install loop proves out:

- **Public gallery** of your templates that followers browse on mobile and open directly.
- **"Made with" attribution** stamp/link on exports — organic growth.
- **Accounts + a template gallery/marketplace** (TODO: *multi-user support*) — the platform
  build-out, deferred until the client loop is winning.

---

## Explicitly deprioritized: render-as-a-service

The `Snapshot → Job → BullMQ → S3` chain is a capable headless render farm, and it stays —
as the **owner's** private tool for heavy/batch jobs. But exposing it as a public API,
data-driven batch export, and scheduled renders is **not** the direction: it pulls toward
infrastructure and installation, which is the opposite of the zero-install creator goal.
Keep it maintained; don't invest in productizing it right now.

---

## If I had to sequence it

1. **Validate cross-device recording** (iOS Safari especially) — this gates everything.
2. **URL-encoded share/remix links** — the viral loop, no backend.
3. **Deploy to the edge + PWA polish** — make "no install" literally true.
4. **Feature the reactive templates + mobile-first quick-controls** — the content hooks.
5. **NL → params (AI)** — the wow, as one serverless route.
6. **Multi-aspect / vertical-first export** — on-platform output.

Threaded throughout: **lift interaction bindings to the engine layer** so the reactivity
that makes great content isn't locked to p5.
