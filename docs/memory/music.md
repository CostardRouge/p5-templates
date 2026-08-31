# Music model

Read before touching `src/types/music.types.ts`, `docs/music/`, anything addressing
musical time, or any MIDI / Ableton integration.

## The music layer is descriptive before it is generative

2026-08-31 — The first codification describes a piece's **structure** (sections, phrases,
tension curves, markers, layer densities) and deliberately carries no pitches, no audio
and no playback. **Why**: the structure is what drives an animation, it is the part worth
learning first, and it can be written by hand without music-theory depth. Generative
material was explicitly rejected as a starting point — premature, and it would have
frozen note-level decisions before the vocabulary was stable. **How to apply**: new fields
belong to the descriptive layer unless the generative one is being opened on purpose;
`Motif` is the seam (contour + rhythm grid, never pitches) and it must stay note-free.

## Musical time, never seconds

2026-08-31 — Every position in the model is `bar:beat:tick` (1-based bar and beat,
960 ticks per beat), resolved to seconds and then frames only at read time, by folding
the meter map and then the tempo map. **Why**: a description in seconds does not survive a
tempo change, a meter change or a different frame rate, and 960 PPQ divides by 2/3/4/5/6/8
so triplets and quintuplets stay exact and match the usual MIDI resolution. **How to
apply**: never add a seconds- or frame-valued field to `music.types.ts`. An anacrusis is
bar 0, not a negative offset in bar 1.

## A piece is a generator, not a live input

2026-08-31 — The music timeline belongs to the binding system's **generator** family
(`src/sketches/p5/utils/interaction/bindings.js`: `oscillator`, `ramp`, `sequence`,
`noise`, `random` — computed from loop progression, recording-safe), not to its live
channels (mouse, microphone, MIDI in, which do not reproduce in a server render).
**Why**: the repo's core constraint is that the live preview and the headless capture
render identically. **How to apply**: the planned `music.beat` / `music.bar` /
`music.section` / `music.tension` / `music.density` / `music.onset` channels must be
sampled from the piece's own clock and registered as generators. Building them on the
binding system rather than beside it also means every existing sketch parameter becomes
bindable to a piece with no sketch rewritten.

## MIDI is an output; Ableton never drives the clock

2026-08-31 — WebMidi.js is bundled and a MIDI input picker exists
(`ControlledMidiInputDeviceSelect.tsx`), but the music layer must not take a clock from
them. **Why**: live MIDI in is non-deterministic and breaks headless capture — the same
reason `TODO.md`'s "useAudio / MIDI not working" item is not a blocker for this work.
**How to apply**: driving Ableton *from* a resolved timeline is the intended direction.
Offline MIDI **import**, to seed a `Piece` as data, is allowed — it produces data, not a
clock.

## Tension is a first-class curve, and loudness is not tension

2026-08-31 — `Curve` (continuous 0..1 over bars) and `Marker` (discrete moments: drop,
break, climax, release, silence, surprise) are stored independently of notes and of any
audio signal. The standard curve ids are `tension`, `density`, `energy`, `brightness`, so
a sketch can bind to `tension` without knowing which piece plays. **Why**: tension is a
property of expectation, not of the signal — in the worked example it peaks in the bar of
*silence* and falls at the drop, because the drop is the release. A visual bound to
loudness inverts the intent. **How to apply**: keep every normalised value in 0..1 so it
feeds the binding pipeline's range-map without conversion, and when describing a
deliberate subversion, pair the harmonic fact (`CadenceKind: "deceptive"`) with the
rhetorical marker (`"surprise"`) at the same position.

## Silence and repeats are declared, not inferred

2026-08-31 — `PhraseRole` includes `"silence"` and `"anacrusis"`; `Section` carries
`repeatOf` and `variationOf`. **Why**: a silent bar is an event with a position and a
length (an animation should *hold* on it, not idle through it), and whether material is
returning or arriving is most of what a listener actually tracks — neither can be
recovered from an audio signal after the fact. **How to apply**: describe them explicitly
rather than leaving gaps in the phrase list.

## The worked example is TypeScript, not a code block

2026-08-31 — The canonical example lives in `src/types/music.example.ts` and `docs/music/`
references it by path instead of copying it. **Why**: `tsconfig.json` includes `**/*.ts`,
so `npm run typecheck` compiles it against the types and a drifted example fails the
build — whereas a fenced block in `docs/` rots silently, which the rest of `docs/` amply
demonstrates. Note that Jest would *not* catch it: `jest.config.js` runs ts-jest with
`diagnostics: false`. **How to apply**: extend the example rather than pasting new
snippets into the docs, and treat `npm run typecheck` as the gate for this area.

## `docs/music/` is maintained

2026-08-31 — Unlike the rest of `docs/`, which `CLAUDE.md` flags as historical
point-in-time write-ups, `docs/music/` is kept true like `docs/memory/`. **How to apply**:
update it with the code or delete the part that became false; do not let it become
another stale write-up.
