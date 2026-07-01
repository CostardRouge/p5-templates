# Sound Feedback on Value Changes

Two surfaces now click pleasingly when a value changes:

1. **The template options panel (editor UI)** — every option edit ticks, and
   the action buttons (reset / randomize / save defaults / generate
   thumbnail / preview) give an audible confirmation.
2. **The `specs` content item (on-canvas overlay)** — whenever a spec line's
   value changes, the sketch itself clicks. Because this routes through the
   sketch audio engine, the clicks are also **baked into recordings**
   (realtime and deterministic/server captures alike).

Both share one synthesiser: `src/lib/clickSynth.ts`.

---

## Shared click synth (`src/lib/clickSynth.ts`)

Context-agnostic Web Audio voices — they run identically against a live
`AudioContext` and an `OfflineAudioContext` (which is what makes the specs
clicks render into deterministic captures).

| Preset       | Character                                             |
| ------------ | ----------------------------------------------------- |
| `click`      | Soft camera-shutter tick (noise snap + faint sine)    |
| `tick`       | Bright, dry metronome tick                            |
| `blip`       | Rounded triangle "bip"                                |
| `pop`        | Bubble pop (downward pitch sweep)                     |
| `beep`       | Plain sine confirmation                               |
| `wood`       | Woodblock knock                                       |
| `typewriter` | Two-part mechanical key strike                        |

Every preset takes `{ gain, rate }` — `rate` transposes the whole recipe
(2 = octave up), which is what all the pitch options below are built on.

---

## Specs content item: `sound` option group

New `sound` group on the `specs` item (`SpecsItemSchema.sound`), edited in the
content panel under **Sound on change**. Disabled by default; existing decks
parse unchanged.

| Option            | Default   | What it does                                                                  |
| ----------------- | --------- | ----------------------------------------------------------------------------- |
| `enabled`         | `false`   | Master switch.                                                                 |
| `preset`          | `click`   | Voice from the shared synth.                                                   |
| `volume`          | `0.5`     | Click gain (0–1).                                                              |
| `pitch`           | `1`       | Global pitch multiplier (0.25–4).                                              |
| `pitchVariation`  | `0.1`     | Random per-click detune ("humanize", 1 ≈ ±half an octave).                     |
| `linePitchSpread` | `0`       | Pitch offset by line index, in octaves across the list — each line gets a tone.|
| `minInterval`     | `0.05` s  | Simultaneous changes are *staggered* by this gap (slot-machine cascade).       |
| `lineCooldown`    | `0.15` s  | A line changing every frame (montage morph) clicks at most once per window.   |
| `maxBurst`        | `12`      | Hard cap on queued clicks.                                                     |
| `repeat`          | `once`    | See below.                                                                     |

### Repeat modes

- **`once`** — one click per change.
- **`count`** — a burst: `times` clicks (2–16), `interval` seconds apart, with
  an optional `pitchStep` ramp in octaves per click (rising/falling spin-up).
- **`while-highlighted`** — Geiger-style: keeps clicking every `interval`
  seconds for as long as the highlight effect stays hot (bounded by the
  highlight's `duration`). Works with the highlight set to `off` too (falls
  back to the default 0.9 s window).

### How it plays — and records

Change detection rides the same tracker as the visual highlight
(`specsChanges.js`). Clicks fire through `audio.trigger("click", …)`
(`src/templates/p5/utils/audio.js`), so:

- **Live editing / playback**: clicks play through the sketch's audio engine
  (first pointer/key gesture unlocks the AudioContext, per autoplay policy).
- **Realtime browser recording**: the engine's master output is mixed into
  the MediaRecorder — clicks land in the `.webm`.
- **Deterministic / server capture**: triggers are logged with sketch-time
  timestamps and rendered offline, sample-accurate against the frame-stepped
  timeline — clicks land in the exported video.

Scheduling is polled per drawn frame on the sketch clock (`time.seconds()`),
never `setTimeout`, which is what keeps captures deterministic. The scheduler
also resets itself when the clock jumps backwards (capture restart).

---

## Editor UI sounds (`src/lib/uiSound.ts`)

A separate, editor-only sound path: it owns its own `AudioContext` and is
**never** registered on the audio bridge, so panel feedback cannot leak into
a recording.

- **Value ticks** — hooked into the options form (`useFormState`): any field
  edit (sliders, inputs, content items, per-slide sketch settings) ticks.
  Form-level events (reset, initial populate) stay silent.
- **Action clicks** — the sketch-settings actions row (reset / randomize /
  save defaults / …) plays a slightly lower confirmation click.

Settings live in the 🔊 button in the sketch-settings actions row and persist
in `localStorage` (`p5templates.uiSound.v1`):

| Setting                | Default | What it does                                                        |
| ---------------------- | ------- | ------------------------------------------------------------------- |
| Sound on value change  | off     | Master switch.                                                      |
| Sound on action buttons| on      | Confirmation click on the actions row.                              |
| Click sound            | `click` | Preset from the shared synth.                                       |
| Volume                 | `0.4`   | Click gain.                                                         |
| Pitch (×)              | `1`     | Global pitch multiplier.                                            |
| Humanize               | `0.08`  | Random per-click detune.                                            |
| Pitch varies by field  | on      | Stable per-field tone (hash of the field path, ±0.35 octaves) — the same slider always ticks at the same pitch. |
| Min gap (ms)           | `45`    | Throttle: slider drags tick at a musical rate instead of machine-gunning. |
| Clicks per change      | `1`     | >1 turns each change into a small burst (the repeating option).     |
| Repeat interval (ms)   | `70`    | Gap between burst clicks.                                           |
| Pitch ramp (oct/click) | `0.08`  | Rising/falling burst.                                               |
| Test sound             | —       | Preview the current settings.                                       |

---

## Tests

- `src/types/__tests__/specsSound.test.ts` — schema defaults, healing of
  pre-sound decks, repeat-mode defaults, schema ↔ form-config ↔ synth-preset
  alignment.
- `src/templates/p5/utils/slides/common/__tests__/specsSound.test.ts` —
  scheduler behaviour: staggering, per-line cooldown, burst cap, both repeat
  modes, line pitch spread, backwards-clock reset, and the
  `computeSpecsHeats` change callback.
