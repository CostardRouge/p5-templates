# Music — a declarative model

Sketchbook is a motion-design tool. This folder is the start of a musical layer on top
of it: a vocabulary, and a schema that turns a piece of music into **data an animation
can read**. It exists for two reasons at once — to learn the vocabulary of music
properly, and to make that vocabulary usable by a renderer.

> **This folder is maintained.** The rest of `docs/` is historical and much of it
> describes code that has since changed (`CLAUDE.md` says so, and it is right). `docs/music/`
> and `docs/memory/` are the exceptions: keep them true or delete them.

## Read in this order

| File | What it holds |
| --- | --- |
| `vocabulary.md` | The seven axes of musical vocabulary. Every term with its French equivalent, a one-line definition, the field of the model that carries it, and what it can mean visually. |
| `model.md` | How the schema fits together, how musical time resolves to frames, and the worked example. |
| `../../src/types/music.types.ts` | The schema itself, in TypeScript. The source of truth. |
| `../../src/types/music.example.ts` | A 32-bar piece described end to end, compiled on every `npm run typecheck`. |

## What this layer is, and is not

It is **descriptive**: it says where the sections, phrases, tension and accents of a
piece are. It carries no pitches, plays no sound, and does not need an audio file. That
is deliberate — the structure of a piece is what drives an animation, and it is also the
part that is worth learning first.

It is **not generative**, yet. Note-level material, chord voicings and MIDI output are a
future layer. The schema leaves them a seam (`Motif` describes shape rather than pitch,
`Layer.instrument` is where a MIDI track name will attach) but defines none of it.

## Four rules the schema is built on

1. **Musical time is the addressing system.** Every position is `bar:beat:tick`, never a
   number of seconds or frames. A tempo map converts to seconds and then to frames at
   read time, so a description survives a tempo change, a frame-rate change and an
   export at any resolution. Interop resolution is 960 ticks per beat — the usual MIDI
   PPQ, divisible by 2, 3, 4, 5, 6 and 8, so triplets and quintuplets stay exact.

2. **A piece is a deterministic source, in the generator family.** The binding system
   (`src/sketches/p5/utils/interaction/bindings.js`) splits inputs in two: *live
   channels* (mouse, microphone, MIDI in) which cannot be reproduced in a headless
   render, and *generators* (oscillator, ramp, sequence, noise) computed from the loop's
   own progression and therefore recording-safe. A piece belongs to the **second**
   family: sampled from its own clock, the same bar always yields the same value. The
   future `music.*` channels must be built that way.

3. **MIDI is an output, never the clock.** Live MIDI input breaks the repo's core
   promise that the live preview and the headless capture render identically. Ableton
   gets driven *from* the timeline; it never drives it. (WebMidi.js is already bundled
   and a MIDI device picker exists — resist using them here.)

4. **Tension is a first-class object**, orthogonal to notes: a curve over bars, plus
   discrete markers. It is what maps most directly onto motion design, and it works
   before a single pitch has been written down.

## Roadmap

- [x] Vocabulary and schema (this folder + `src/types/music.types.ts`)
- [ ] Musical time → seconds → frames resolver, with tests
- [ ] `music.*` binding channels (`music.beat`, `music.bar`, `music.section`,
      `music.tension`) in the generator family, so any existing sketch parameter can be
      bound to a piece
- [ ] A visual representation of a piece — the arrangement seen as a timeline, which is
      also a debugging tool for everything above
- [ ] An editor to assemble pieces from known building blocks
- [ ] MIDI export to Ableton (output only, per rule 3)
