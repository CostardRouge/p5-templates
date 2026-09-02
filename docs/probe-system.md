# Probe system — reading a sketch's internal values

> Design proposal, 2026-09-02. Nothing is implemented. This is the evaluation
> asked for before any code: what exists, what is missing, what it would cost,
> what is worth building and in which order.

## 1. The gap, stated precisely

A sketch page can already *display* and *modulate* values. It can do neither
with the numbers a sketch computes while it draws.

Three source namespaces exist today, and none of them reaches inside `draw()`:

| Namespace | Where | What it can address | Who consumes it |
| --- | --- | --- | --- |
| HUD sources | `p5/utils/hud/sources.js` + `keyPaths.js` | 19 built-ins (fps, frame, progression, mouse, resolution, sketch identity…) and any **dotted key-path into `options.sketch`** | the seven `hud-*` content items, the `specs` overlay |
| Interaction channels | `p5/utils/interaction/channels.js` + `sources.js` | a static manifest of **input** channels (mouse, touch, hands, face, audio bands, gyro, MIDI, joypad) plus five generators computed from the loop clock | the binding resolver (`bindings.js`) |
| Sketch settings | `options.sketch` | the form's own parameters | everything |

All three are *inputs*: what the user set, or what a device is doing. What the
sketch **derived** from them — a lerped radius, an eased head position, a
per-element progression, a count of what survived a cull — exists only inside
`draw()` and dies there.

Two consequences the notes name directly:

- **Live report of a value, so it can be shown in the HUD and the specs.** A
  gauge can show `magnitude.start` (a parameter) but not `radius` (what that
  parameter became after four mappings).
- **Live report of a granular progression, so a binding can stagger off
  something happening in the sketch.** A binding can only follow a device or a
  generator. It cannot follow the sketch itself.

Note also that the two namespaces are disjoint in both directions: a HUD widget
cannot read an interaction channel, and a binding cannot read a sketch
parameter. A probe namespace is the first source both would share — a reason to
give it one id scheme from the start, and a reason *not* to try to unify the
other two in the same change.

## 2. Constraints any design has to satisfy

These are not preferences; each one has already produced a bug in this repo.

1. **Capture determinism.** A sketch must render identically live and in
   headless capture (`docs/memory/architecture.md`). A probe is computed by the
   sketch from the sketch's own deterministic state, so — unlike the mouse or a
   camera — **probes are the first non-generator binding source that survives a
   server render.** That is a real selling point, and it holds only if the
   published value is a frozen per-frame snapshot (see 5).
2. **A sketch can be a layer inside another sketch.** One module evaluation
   backs several running instances (`instanceState.js`). A flat module-level
   probe map would mix a layer's `radius` with the page's — the exact class of
   bug `sketch.state()` was written for. Probes must be keyed per instance, by
   the same surface-override key.
3. **Cardinality, not call cost, is the performance risk.** `probe( "r", x )`
   in a loop over 5 000 particles is 5 000 writes to one slot per frame; the
   last one wins and means nothing. Cardinality has to be a first-class part of
   the API, not a caveat in a doc.
4. **Zero cost when nobody is looking.** Most frames, of most sketches, nothing
   subscribes. The probe call must compile down to an identity function.
5. **A malformed probe must never break a sketch** — same rule the binding
   resolver and the channel sampler already follow (`try {} catch {}` around
   every telemetry pass in `options.js`).

## 3. The primitive

One function, returning its own input, so it drops into an expression without
restructuring the code around it:

```js
import probe from "@/p5/utils/probe.js";

const radius = probe( "radius", mappers.fn( n, 0, 1, min, max, easing ) );
```

Three shapes, because cardinality is a first-class concern:

| Call | Slots | Use |
| --- | --- | --- |
| `probe( name, value, meta? )` | one, last write wins | a value computed once per frame |
| `probe.fold( name, value, "min"\|"max"\|"mean"\|"count" )` | one, O(1) per call | a value computed per element, read as an aggregate |
| `probe.each( name, index, value )` | a bounded array (cap ~256) | per-element values — what a stagger needs |

`meta` is optional and display-only: `{ label, unit, min, max }`. It is recorded
on first write of a frame; a probe with no meta still shows up, labelled by its
own name.

The registry records a **write count per name per frame**, so the inspector can
say *"written 5 000× this frame — this is a fold, not a value"* instead of
silently showing the last particle's radius. That single number is what stops
the API from being misused, and it costs one increment.

**Probes are read-only.** "Interactivity" in the notes is achieved by binding a
*parameter* from a probe, not by writing back through one. A writable port is a
different feature with different consequences (undo, persistence, capture) and
should stay out of scope.

## 4. Retroactivity — what is free, what is not, and what to refuse

The question asked was whether probes could live inside the existing utilities
(`animation.ease`, `mappers.fn`) so that existing sketches become observable
without being edited. The answer is mostly no, and the reason is worth writing
down once:

- The mapping helpers are called **anonymously**: ~291 `mappers.fn(`, ~148
  `mappers.circular*`, ~93 `animation.ease(`, ~80 `.lerp(` across 269 files.
  None of those call sites carries a name, and **a value without a stable name
  is not a probe** — it cannot be selected in a dropdown, saved in a HUD widget,
  or referenced by a binding.
- **Auto-instrumenting by call site** (a build-time transform stamping
  `file:line`, or reading a stack trace) is the version that looks retroactive.
  Refuse it: it needs a custom SWC/Babel plugin inside a Turbopack build to stay
  correct, it produces ids nobody wants to read
  (`mappers.fn@dragon-corridor-v3:412`), those ids move whenever the file is
  edited — so every saved HUD widget and binding breaks on a refactor — and a
  single call site inside a loop is thousands of writes per frame. This is very
  likely what made the earlier attempt "bancal". A probe's name must be written
  by a human, on purpose.

What *is* free, with no sketch edit:

- **The three helpers that already take a key** — `mappers.valuer( key, … )`
  (which already stores `{ value, min, max, smooth }`, i.e. it is a probe that
  publishes nowhere), `mappers.smoother( key, … )` and
  `animation.sequence( key, … )`. Auto-publishing those as `probe:valuer.<key>`
  is a handful of lines. Small in practice today (`valuer` has exactly one call
  site, inside `traceVectors`), but every future use comes pre-instrumented.
- **`sketch.state()` records** — 126 sketch files declare one, and it is already
  a named, per-instance object. A "walk the current instance's state record once
  per frame and publish its scalar fields" mode is genuinely retroactive across
  the whole catalogue. Be honest about the value though: those records mostly
  hold caches (`shapes: []`, `lastLayout: ""`), not the lerped values this
  system is for. Ship it as a debugging convenience, never as the answer.

So: **the useful probes require touching sketch code, one line per value.** That
is acceptable — it is opt-in, incremental, and matches how the feature would
actually be used (specific values in specific sketches, not a firehose).

## 5. Wiring

### 5.1 Registry and snapshot

`p5/utils/probe.js` holds a per-instance record (`createKeyedStore`, keyed like
`sketch.state()`), reset at the top of each frame. At the end of the frame the
records are flattened into one snapshot:

- the page's probes as `probe:<name>`,
- a layer's probes as `probe:<layerId>.<name>`, so a HUD widget on the host page
  can read into a sketch layer.

The snapshot is **frozen for the frame**. Every consumer in that frame sees the
same numbers, whatever order they read in — the same rule `sampleChannels`
already follows by memoizing on `frameCount`, and the reason capture reproduces.

### 5.2 Frame ordering, and the one-frame delay

Bindings resolve when `options.sketch` is read, which is at the top of `draw()`;
probes are written during `draw()`. A binding that reads a probe therefore reads
**frame N−1's value**. This is not a defect to hide:

- it is deterministic (headless capture renders frames in order from 0), so it
  reproduces;
- it is what makes a feedback loop legal — binding a parameter from a probe
  computed *from* that parameter is a delay-1 loop, not an infinite recursion.

It must be documented on the probe source in the binding UI, in one line.

### 5.3 Consumers

**Runtime → UI bridge.** Reuse the `channelBridge.ts` pattern exactly: the
engine publishes once per frame, values go to CSS custom properties (so meters
and gauges cost no React render), and a small pub/sub carries the *name list*
— republished only when the set of names changes, not every frame.

**HUD (phase 1).** `resolveValue()` gains a `probe:` branch reading the
snapshot; `resolveMeta()` reads the probe's label/unit. The picker
(`ControlledSourceSelect`) gains a "Probes (live)" optgroup fed by the bridge —
and already keeps an unknown saved source selectable (line 95), which is exactly
what a probe that disappeared behind an `if` needs. `history.js` (the sparkline
ring buffer) keys on the source string and needs no change at all. **Three
files.**

**Bindings (phase 2).** `sampleChannels()` merges probe entries as scalar
channels. `channelSourceOptions()` is currently pure and static, which the React
bundle depends on — so keep `DESCRIPTORS` static and let the caller *append* the
discovered probe descriptors (`channelSourceOptions( kind, extra )`), rather
than making the module live.

Normalization is the one real design decision here. A channel is 0..1; a probe
is a raw number in arbitrary units. Recommendation: **publish the raw value**
(the HUD wants raw — that is the whole point of the specs overlay), and let a
binding on a probe carry its own input range in `mapping`, like every other
binding already carries `min`/`max`, with a **"learn" button** that fills the
range from the observed min/max. Deterministic, no hidden adaptive state, and it
reuses the popover's existing shape. Auto-ranging on a running min/max is the
tempting alternative and should be refused: it makes the same frame render
differently depending on what was rendered before it.

**Inspector (phase 1.5).** A "Probes" floating card listing every probe the
running sketch publishes — name, live value, write count, sparkline. It is the
discovery UI, and it is where the debugging payoff actually lands. It follows
the conventions in `docs/memory/interaction-bindings.md`: shared control
primitives, `LayerRow`-style rows, and its own `text-xs` root (it floats outside
`ItemListRenderer`'s wrapper).

### 5.4 Discovery: runtime, not declaration

Probes are discovered by running the sketch, not declared in its `options.ts`.
This matches the explicit choice already made for HUD sources ("enumerate the
keys that already exist … no probe registry", `keyPaths.js`), avoids a fourth
generated registry to keep in sync, and cannot drift. The cost is that the list
is empty until the first frame — irrelevant, since the sketch is always running
while its options are being edited.

## 6. Performance

- **Off:** one call and one boolean test per probe site, monomorphic and
  inlinable. Enabled state is recomputed once per frame from "does any HUD
  widget, binding or open inspector reference a probe?". Negligible at
  thousands of sites per frame; **not** negligible at 100 000, which is why the
  rule is *probe outside the inner loop, or use `probe.fold`*.
- **On:** one `Map` lookup and one numeric write per call, bounded by the number
  of distinct **names**, not calls, when folding is used.
- **Allocation:** write into preallocated slots reused across frames. A probe
  system that allocates an object per probe per frame trades a readout for GC
  pauses, which in a 60fps loop is a worse bug than the one it solves.
- **Publish:** once per frame. CSS vars for the values; the name list only on
  change.

## 7. Phases, and whether it is worth it

| Phase | Scope | Surgery | Verdict |
| --- | --- | --- | --- |
| **1 — display** | `probe.js` + registry + bridge; `probe:` in HUD sources and the picker; instrument two or three sketches | ~4 new files, 3 edited | **Yes.** High value, low risk, additive: a sketch that publishes nothing behaves exactly as today. |
| **1.5 — inspector** | the Probes floating card | 1 component | **Yes**, and it should ship with phase 1 — without it, nobody knows what a sketch exposes. |
| **2 — probe as a binding source** | channels merge, source list, input range + learn, the one-frame-delay note | `channels.js`, `bindingUtils.ts`, the affordance | **Yes**, behind the existing `INTERACTION_BINDINGS` flag. This is the first capture-safe non-generator source. |
| **3 — `probe.each` / granular stagger** | array probes, indexed addressing (`probe:letters.progress[7]`), a stagger mapping | new addressing in both consumers | **Hold.** The most speculative half of the notes and the one without a concrete sketch behind it yet. Revisit once phases 1–2 have been used on a real sketch; the shape of the stagger will be obvious then and guessed wrong now. |

Phase 1 alone answers the first line of the notes. Phase 2 answers the second
line for scalar values. Phase 3 is the only part that should wait for a use
case.

## 8. Decisions still open

- **Flag or not.** The HUD half is inert without probes and could ship
  unflagged; the binding half naturally rides `INTERACTION_BINDINGS`. Splitting
  them that way is the recommendation, but it is the maintainer's call.
- **Layer addressing.** `probe:<layerId>.<name>` assumes a content-item id is
  stable enough to save in a HUD widget. Worth confirming against how the
  `sketch` content item identifies itself today.
- **`probe.fold` default.** Whether a bare `probe()` written N times a frame
  should silently mean "last", or whether the write count should make it an
  explicit error in the inspector.
