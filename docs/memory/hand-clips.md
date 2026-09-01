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

- 2026-09-01 — **The recorder samples on inference, not on draw**
  (`handClips/recorder.js`): a sample is pushed only when
  `mediapipe.tasks.hands.updatedAt` advanced, timestamped with that value
  (the inference's own completion time), and the take's clock starts on its
  first tracked hand rather than on the key press — while the max-length
  cutoff (`elapsed`) runs on the wall clock from `start()`, because a take
  with no hand yet has no sample clock (found headlessly: with `t0` unset the
  cutoff fired on the first frame). Polling per draw frame
  would store each ~30 fps result two or three times and lie about speed.
  Landmarks are stored normalized with x mirrored when the capture is
  flipped — the interaction layer's `_normToCanvas` orientation — never in
  canvas px. MediaPipe's handedness label describes the MIRRORED image, so
  with a flipped webcam "Right" is the hand you see on the right.
- 2026-09-01 — **The studio is a sketch** (`hand-capture/hand-clip-studio-v1`,
  `.hidden-home`), not a React page: the options form, HUD and routing come
  free, and it stays in the repo's "everything is a sketch" grain. It runs on
  `deltaTime`, reads the camera and is not capture material. Its
  review timeline lets the close/open markers be nudged by hand
  (`[ ] { }`) because auto-detection lands off on ambiguous takes; the
  calibration readout derives the valid playback hand-scale window from
  `gapRange` against a target `pinchPx × releaseRatio`.
- 2026-09-01 — **`POST /api/dev/save-hand-clip`** writes a clip into
  `shared/handClips/<slug>.json`, dev-only like `save-defaults`; it
  round-trips the payload through `parseHandClip` so nothing invalid lands
  in the library. The studio gates the call on
  `process.env.NODE_ENV === "development"` (Next inlines it client-side, same
  as `SaveDefaultsButton`).

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

player (`sample( clip, u, out )`, zero-alloc reused output buffer) +
retarget + `createVirtualHandTroupe()` (reuses rings-v8's clock-pure
scheduling, emits hand groups instead of cursor icons) → demo sketch
`hand-clip-replay-v1`. `rings-v9` only after the format is proven. The
shared library (`shared/handClips/`) still holds no clip: the maintainer
records the reference takes in the studio — an agent cannot.
