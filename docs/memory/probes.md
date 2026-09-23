# Probes — a sketch's internal values, exposed by name

Read this before touching `src/sketches/p5/utils/probe.js` / `probeRegistry.js`, `src/lib/probeBridge.ts`, the `probe:` branch of `hud/sources.js`, the "Probes (live)" group of `ControlledSourceSelect`, or the `ProbesPanel` card. The design, the phases and the options that were refused are in `docs/probe-system.md` (a point-in-time proposal, kept; the rules below are what shipped and hold).

## What a probe is, and what it is not

2026-09-23 — `probe( name, value, meta? )` records `value` under `name` for the sketch instance drawing now and **returns it unchanged**, so it drops into an expression (`const f = probe( "head", phase * K )`). A probe is the third source family a HUD widget can read — `probe:<name>`, beside the built-ins and the settings key-paths — and the only one that is not an input: it is what the sketch *derived*. It is **read-only**: "interactivity" is a binding driving a parameter *from* a probe (phase 2, not shipped), never a write back through one.

**How to apply**: a probe is capture-safe by construction (computed from the sketch's own deterministic state, never a device), so it may be shown in a recording. The HUD reads it in the same frame it was written — widgets draw in `slides.render()`'s post-draw pass, after the page's draw.

## The registry: per instance, per frame, no allocation

2026-09-23 — `probeRegistry.js` is the pure core (unit-tested with a fake key and a hand-advanced frame); `probe.js` wires one instance to the runtime and registers its lifecycle from `options.js`'s `registerEvents()` (reset on `pre-setup`, `beginFrame` on `pre-draw`, publish on `post-draw`). Three rules, each already paid for elsewhere in this repo:

- **Slots are keyed per instance** like `sketch.state()` — by the surface override, the page when none — so two layers of one sketch never write into each other's slots. A layer's probes are recorded but **neither readable nor published yet**: a WeakMap cannot be walked, and naming a layer is an open decision (see open items).
- **A slot is a plain object reused across frames**, stamped with the frame it was last written; nothing is cleared per frame and nothing is allocated after a name's first write. Cost per call: one `Map` lookup and a few field writes — measured on the pure registry under Node 22: 12 probes a frame cost 0.03 ms, 100 000 writes a frame 2.5 ms (≈25 ns a call), and `fold` the same. So **the cost is the call, and `fold` does not make a 100 000-write loop free — it makes its result meaningful**; a per-particle loop still wants one probe per aggregate, not one per particle. There is deliberately **no off switch** — at that price it would cost more to keep right than it saves. The `post-draw` publish skips itself once the snapshot has been empty, so a sketch with no probes costs the studio nothing.
- **Liveness is "written this frame or the previous one"**. The one-frame tolerance is on purpose: a sketch layer draws inside the same post-draw pass as the HUD and may land after the widget reading it, and without the tolerance such a probe would flicker between a value and nothing. Beyond that a probe is *absent* (`undefined` → the readout prints an em dash), never a frozen last value — the same rule as a live interaction channel.

## Cardinality is the API's concern, not a caveat

2026-09-23 — `probe( "r", x )` inside a loop over 5 000 particles is 5 000 writes to one slot, and the last one means nothing. So every slot **counts its writes per frame**, the inspector shows `×N` in amber on a plain probe, and `probe.fold( name, value, "mean" | "min" | "max" | "sum" | "count" | "last" )` turns a name written N times into one tenable number in O(1) a call. A non-numeric value folds as "last" whatever the mode. **Never throw in a draw loop** over this: the count is a badge, not an error.

## Discovery is runtime, and the UI never becomes state per frame

2026-09-23 — Probes are discovered by running the sketch, not declared in `options.ts` (the choice `hud/keyPaths.js` already made for key-paths: enumerate what exists, no fourth generated registry to drift). `probeBridge.ts` receives a snapshot **every frame**; `useLiveProbes` (`src/hooks/`) compares a signature of names/shapes/folds and re-renders only when a probe appears or disappears (the rule `useLiveChannelIds` set for MIDI channels), and `ProbesPanel` writes the live values into the DOM from its own subscription. **Apply when adding a consumer**: never `setState` a snapshot; subscribe and compare, or write to refs.

- **A picker offers what its consumer can read**: the point pickers list the point-shaped probes (`{ x, y }`), the scalar pickers the rest; `meta.label`/`meta.unit` name the option. A saved `probe:` source that is not arriving (after a reload, or while its branch is not running) stays selectable as "`<name>` (not arriving)" — a React-controlled `<select>` with no matching option would otherwise show the first entry over the saved value and write it on the next change.
- **The inspector is a dev affordance** (`useDevActions().devActionsVisible`, so it never renders in a production bundle) and is hidden while the sketch publishes nothing. It stacks above the Interactive mixer in one bottom-anchored flex column in both layouts — the docked mount of the mixer moved into that column for it, per the shared-flex-column rule in `interaction-bindings.md`.

## Not built, and why

2026-09-23 — Instrumenting the anonymous helpers (`mappers.fn`, `animation.ease`, `.lerp`: ~600 call sites) and auto-naming them by call site were both refused — a value without a human-written stable name cannot be selected, saved or bound, and a call-site id breaks every saved widget on a refactor (`docs/probe-system.md` §4). The `sketch.state()` record walk was cut too: it would expose caches (`shapes`, `lastLayout`), not the lerped values the system is for. `probe.each` (array probes for a stagger) waits for a real sketch to need it.
