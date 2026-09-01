# Shared hand clips

Portable pre-recorded hand-landmark takes in the `p5t-handclip` .json format
— produced by the hand-clip studio sketch (record a pinch/drag with your own
hand on camera, bake, export) or by `bakeHandClip()` in
`src/sketches/p5/utils/interaction/handClips/process.js`.

Drop a downloaded `.json` here to make it importable by any sketch:

```js
import pinchDrag from "@/p5/shared/handClips/pinch-drag-slow.json";
import {
  parseHandClip
} from "@/p5/shared/handClip.js";

const clip = parseHandClip( pinchDrag );
```

Replayed as a hand-shaped group (`{ id, points }`, trailing five points =
fingertips in MediaPipe order) a clip goes through the SAME
`createPinchTracker()` → `draggable.update()` path as a live camera hand
(`utils/interaction/handPinch.js`) — it pinches, drags and renders exactly
like one, with no camera and no inference, so it also replays in headless
capture and is deterministic frame for frame.

## Format (`p5t-handclip`, version 1)

| Field | Meaning |
|---|---|
| `format` / `version` | Identifier + schema version, validated by `parseHandClip` |
| `name`, `tags`, `handedness` | Human metadata; `name` drives the download filename |
| `fps` | Actual uniform frame rate the take was baked at (~the requested one) |
| `frameCount` | Number of baked frames |
| `layout` | `landmarks-21` (full MediaPipe hand) or `tips-6` (palm + five fingertips) |
| `space` / `aspect` | Always `normalized` — 0..1 in the capture frame, x in display orientation — plus the capture frame's aspect so playback can de-shear |
| `quant` | Coordinate quantization: stored values are `round( value × quant )` integers |
| `frames` | Flat `frameCount × pointCount × 2` quantized coordinates (authoritative) |
| `phases` | Detected pinch timeline `{ enter, close, drag, open, exit }` in frame indices, or `null` when the take never pinched |
| `anchors` | Thumb/index midpoint at `close` (`grab`) and at `open` (`release`) — what retargeting maps onto a sketch's A→B pair |
| `gapRange` | `[min, max]` thumb/index gap (normalized) — calibrates a playback hand scale against a sketch's `pinch` threshold |
| `capture` | Provenance: real distinct-sample rate, sample count, recording date |

The baking pipeline (dedupe → zero-phase One-Euro smoothing → uniform Hermite
resampling → phase/anchor detection) lives in
`utils/interaction/handClips/process.js`; everything expensive happens there,
once — playback is an index plus a lerp.
