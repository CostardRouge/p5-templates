# Shared wavetables

Portable wavetable presets in the `p5t-wavetable` .json format, produced by the
`audio/wavetable-v1` sketch (press **E** in the sketch to download the current
table) or by `generateWavetable()` in `src/templates/p5/shared/wavetable.js`.

Drop a downloaded `.json` here to make it importable by any sketch:

```js
import wavetableJson from "@/p5/shared/wavetables/aurora-pad.json";
import {
  parseWavetable,
  renderNotePcm
} from "@/p5/shared/wavetable.js";

const table = parseWavetable( wavetableJson );
const pcm = renderNotePcm(
  table,
  {
    freq: 220,
    duration: 0.5,
    morphFrom: 0,
    morphTo: 1
  }
);
```

## Format (`p5t-wavetable`, version 1)

| Field | Meaning |
|---|---|
| `format` / `version` | Identifier + schema version, validated by `parseWavetable` |
| `name` | Human name, used for the download filename |
| `frameSize` | Samples per single-cycle frame |
| `frameCount` | Number of frames in the morph stack |
| `frames` | The baked waveforms (authoritative) — `frameCount` arrays of `frameSize` floats in [-1, 1] |
| `spec` | The generating recipe (mode, seed, harmonics, …) — deterministic, so `generateWavetable( spec )` reproduces `frames` exactly. Keep it to re-derive or tweak the sound; `null` for hand-drawn/imported tables |
