# Hand clips — recorded hand-landmark takes, replayed as virtual hands

Read before touching `shared/handClip.js`, `shared/handClips/`,
`utils/interaction/handClips/`, the hand-clip studio, or anything replaying
recorded hand motion.

## The design in one paragraph

2026-09-01 — A hand clip is a take of one tracked hand (MediaPipe landmarks),
cleaned OFFLINE into a uniform-fps flat array and replayed as hand-shaped
groups (`{ id, points }`, trailing five = fingertips in MediaPipe order).
That shape is the deliberate seam of `pinchMath.js`/`handPinch.js` — replayed
clips pinch, drag and render exactly like live camera hands, through the same
`createPinchTracker()` → `draggable.update()` path, with **no camera and no
inference**: clip-driven sketches replay in headless capture and are
deterministic frame for frame, which live vision never is. Do not invent a
second pointer path for virtual hands; emit groups and let the existing
trackers do the work.

## Decisions

- 2026-09-01 — **All expensive processing happens once, at bake time** —
  never at playback. Rationale: inference is irregular (~25–35 fps) while
  playback wants 60; baking (`bakeHandClip` in
  `utils/interaction/handClips/process.js`) dedupes, smooths and resamples so
  playback is one index + one lerp. Any future "clean this clip better" idea
  belongs in the bake pipeline, not the player.
- 2026-09-01 — **Zero-phase One-Euro smoothing** (forward + backward,
  filtfilt-style), not the live layer's EMA: offline we can see the future,
  so the phase lag cancels and symmetric gestures stay symmetric. There is
  still no one-euro/Kalman anywhere in the LIVE path — that remains plain
  EMA (`_smoothGroups`, `pinchMath`), on purpose.
- 2026-09-01 — **Format `p5t-handclip` v1** (`shared/handClip.js`, patterned
  on `shared/wavetable.js`, import-free / node-safe): normalized 0..1
  coordinates + capture `aspect` (never canvas px — replay must not bake in
  the recording resolution), flat quantized-integer frames (× 4096 — values
  on the quant grid are exact in float32, so round-trips are lossless),
  uniform actual `fps`, detected `phases` `{ enter, close, drag, open, exit }`
  and `anchors` `{ grab, release }` (thumb/index midpoints at close/open) for
  retargeting, `gapRange` for pinch-threshold calibration. Two layouts:
  `landmarks-21` (default, can render a skeleton) and `tips-6` (compact).
- 2026-09-01 — **Retargeting plan** (player, next step): clip anchors
  grab→release map onto a sketch's A→B by similarity (rotation + path scale),
  but the hand's own size uses a SEPARATE fixed pixel `handScale` — scaling
  the hand with the path would break the thumb/index gap against a sketch's
  `pinch` threshold (~70 px). `gapRange` exists to surface "at this scale the
  gap spans X..Y px" in the studio.
- 2026-09-01 — Dedupe keeps the **first and last** sample of a repeat run,
  not first only: a run is a re-polled inference result or a genuinely held
  pose, and dropping the endpoints trims a take that ends on a hold (found
  by test on a synthetic take with a frozen tail).
- 2026-09-01 — Auto phase thresholds are fractions (30 % / 55 %) of the
  take's OWN gap range, with hysteresis like `stepPinch`, refusing ranges
  < 0.015 normalized. The close latch fires partway down the gap transition,
  so grab anchors sit slightly along the drag path — real takes hover before
  dragging so it barely matters, and the studio will let markers be nudged.

## Traps

- 2026-09-01 — A `@returns {object}` JSDoc annotation on a JS function ERASES
  the inferred return shape for TS consumers (typecheck sees `object`, tests
  fail on property access) — and properties initialized `null` then
  reassigned don't reliably evolve either. Give real JSDoc typedefs
  (`HandClip` in `shared/handClip.js`) and reference them via
  `@returns {import("@/p5/shared/handClip.js").HandClip}`.
- 2026-09-01 — `fast-check` is now actually used
  (`shared/__tests__/handClip.test.ts` round-trip,
  `handClips/__tests__/process.test.ts` linear-resample property) — don't
  remove the devDependency.

## Still to build (plan of 2026-08-31, agreed direction)

recorder (`updatedAt`-gated sampling) + studio sketch
(`hand-capture/hand-clip-studio-v1`: on-canvas prompter, draggable A/B
targets, take scrubber, phase-marker nudge, export + dev write route à la
`save-defaults`) → player (`sample( clip, u, out )`, zero-alloc reused
output buffer) + retarget + `createVirtualHandTroupe()` (reuses rings-v8's
clock-pure scheduling, emits hand groups instead of cursor icons) → demo
sketch `hand-clip-replay-v1`. `rings-v9` only after the format is proven.
