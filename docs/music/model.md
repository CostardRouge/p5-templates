# The model — how a piece is described

The schema is `src/types/music.types.ts`; this file explains how its pieces fit together
and why. The worked example is `src/types/music.example.ts` — read it alongside this
page. It is referenced by path rather than copied here on purpose: a copy would rot, and
`docs/` is full of proof that it does. The example compiles on every `npm run typecheck`,
so it cannot drift from the types.

## Four layers, only the first two of which are required

```
Piece
├── time      ──  tempo map + meter map + feel          ← required: the clock
├── sections  ──  form, with phrases inside             ← required: the shape
│   └── Phrase    call / response / fill / silence …
├── curves    ──  tension, density, energy over bars    ← what drives visuals
├── markers   ──  drop, break, climax, silence, surprise
├── layers    ──  who plays, and how busy they are
├── harmony?  ──  keys and chord progression            ← optional annotation
└── motifs?   ──  note-free shapes (contour + rhythm)   ← optional annotation
```

A piece with only `time`, `sections`, `curves` and `markers` is already enough to drive
an animation. `harmony` and `motifs` are annotations you add when you know them — and
learning to fill them in is half the point of the exercise.

## Musical time, and how it becomes a frame

Everything is positioned at `bar:beat:tick`, 1-based, the way musicians count: bar 1 beat
1 is the downbeat of the piece. An anacrusis lives in bar 0. `tick` is a sub-beat offset
with 960 ticks to the beat — the common MIDI PPQ, divisible by 2, 3, 4, 5, 6 and 8, so
triplets and quintuplets stay exact instead of accumulating rounding error.

Nothing in the schema is stored in seconds. Resolution happens at read time, in three
steps:

```
bar:beat:tick  →  beats     (fold the meter map: bars have different lengths in 7/8)
beats          →  seconds   (fold the tempo map: a linear mark is an accelerando)
seconds        →  frame     (× the sketch frame rate)
```

The payoff is that a description survives a tempo change, a meter change, a frame-rate
change and an export at any resolution. The cost is one resolver, which does not exist
yet — it is the next step on the roadmap in `README.md`, and it is the piece to build
first because everything else needs it.

## Tension is stored separately from everything else

`Curve` holds a continuous 0..1 quantity sampled between its points; `Marker` holds a
discrete moment. Neither is derived from the notes, because neither *can* be — tension is
a property of expectation, not of the signal. Two conventions make curves portable:

- The standard ids are `tension`, `density`, `energy` and `brightness`, so a sketch can
  bind to `tension` without knowing which piece is playing. Custom ids are allowed.
- Every value is 0..1, which is exactly what the binding pipeline's range-map consumes
  (`src/sketches/p5/utils/interaction/bindings.js`) — no conversion in between.

**The lesson the example is built to teach**: tension climbs through the build, peaks in
the bar of silence, and *falls* at the drop. The drop is the release. A visual bound to
loudness would swell exactly where the music relaxes; a visual bound to `tension` gets it
right. That inversion is the whole reason tension is a first-class field.

## Form: repeats and variations are declared, not inferred

`Section.repeatOf` marks an identical restatement, `Section.variationOf` an altered one.
A renderer can then show that material is *coming back* rather than arriving — which is
most of what a listener actually tracks. The same distinction exists at phrase level:
`PhraseRole` `"variation"`, and `Phrase.answers` pointing at the phrase being answered,
which is how a call/response pair is written down.

Two roles deserve their own note:

- **`"silence"` is a phrase role.** A bar where nothing plays is an event with a position
  and a length, not a gap between two other phrases. Modelling it as a thing is what lets
  an animation *hold* on it rather than idle through it.
- **`"anacrusis"` leans forward.** It belongs to the bar that follows it, not the one it
  is written in.

## Layers say how busy, never how loud

`LayerActivity.density` is events per bar, normalised — not volume. A build is a rising
density, and that is a fact about the notes rather than about the mix, which keeps the
descriptive layer independent of any particular recording.

An activity span takes **either** a `sectionId` — shorthand for the whole of that section
— **or** an explicit `from` + `lengthBars`. The second form exists so a layer can drop out
for the last bar of a build without the form having to be cut up around it; the example's
kick uses exactly that. The types cannot enforce "exactly one of the two", so it is a
convention here until a validation layer exists.

## Harmony is annotation, and `deceptive` is the point of it

`HarmonyEvent` carries a chord symbol as a musician writes it (`"Am7"`, `"E7#9"`),
optionally its roman-numeral degree, and optionally a `cadence`. `CadenceKind`
`"deceptive"` is the codified surprise: the ear is led to expect the tonic and gets
something else. In the example it lands at bar 16, paired with a `Marker` `"surprise"`,
and the tension curve rises where a listener expected it to fall.

That pairing — a harmonic fact and a rhetorical marker at the same position — is the
intended way to describe any deliberate subversion. The harmony says *what happened*, the
marker says *what it meant*.

## Motifs describe shape, not pitch

`Motif` carries a `contour` (`"up"`, `"leapDown"`, …) and a `rhythm` grid string where
`x` is an onset and `.` a rest, one character per subdivision. No pitches. This is what
keeps the descriptive layer from depending on the generative one: a motif can be
recognised, repeated and varied without the model ever knowing what note it starts on.

## How this reaches a sketch (not built yet)

The binding system already splits inputs into *live channels* — mouse, microphone, MIDI
in, none of which reproduce in a headless render — and *generators*, computed from the
loop's own progression and therefore recording-safe. A piece belongs to the generator
family: sampled from its own clock, the same bar always yields the same value.

The planned channels, all 0..1, all deterministic:

| Channel | Value |
| --- | --- |
| `music.beat` | Position within the current beat — a pulse to lock motion to |
| `music.bar` | Position within the current bar |
| `music.section` | Progress through the current section |
| `music.tension` | The `tension` curve, sampled now |
| `music.density` | The `density` curve, sampled now |
| `music.onset` | A decaying spike on each `Marker` |

Once those exist, **every existing sketch parameter becomes bindable to a piece** through
the form UI that is already there. No sketch needs rewriting. That is the reason for
building the music layer on top of the binding system instead of beside it.

## MIDI and Ableton

Out of scope here, and constrained when it arrives: MIDI is an **output**. Live MIDI
input would break the promise that the live preview and the headless capture render
identically, which is the constraint the whole repo is built around. Ableton gets driven
*from* the timeline — the timeline is never driven from Ableton. Import (reading a MIDI
file to *seed* a `Piece`, offline) is fine and does not violate this: it produces data,
not a clock.
