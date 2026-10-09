# HUD style — the Micrographie charter and the selection UI

Read before drawing a HUD widget, adding a `hud-*` kind, or building the HUD style/selection UI. The item model itself (one content-item type per widget, `anchor` + `offset`, quick-add by value shape) is in `studio-ui.md`.

## The charter (adopted 2026-10-09)

Built and compared as a live specimen sheet (artifact "Micrographie HUD", 38 instruments driven by mock options), then adopted by the maintainer as is ("on garde la charte"). The brief in his words: science-fiction interfaces without overdoing it, minimalism, micro-graphics living on the edges, sides and corners, moving when a value moves. Seven rules, each one a test a new widget must pass:

- **Line first** — everything is a 1px hairline; only the value itself gets 2px or a fill. No shadow, glow or decorative gradient.
- **One ink, one accent that fades** — ink draws; the accent means "this just changed" and decays back to ink (τ = 900 ms, `exp(-t/τ)` mixed ink → accent). Colour carries information, never decoration. The swatch's real colour and the hue strip are the only coloured fills.
- **Micro-type** — monospace (the study used Martian Mono 300/400) at 7–9px, letter-spaced capitals for labels, tabular figures; a label and a value, never a sentence. Large sizes (14–22px) are reserved for the main reading.
- **Edges are the territory** — widgets live in margins, corners and flanks; the centre belongs to the artwork (the crosshair excepted).
- **Nothing moves without a reason** — a widget moves only when its value moves, through a critically damped spring (k = 140, ≈ 0.4 s to 95 %, no overshoot). The loop clock counts as a value, so a timecode or phase hand may run.
- **Show where it came from** — every widget keeps a trace of the previous state: a ghost, a band, a trail, a peak hold, a log. The change is readable, not just the state.
- **Muted sci-fi** — no gratuitous hexagons, scanlines, fake text or numbers scrolling for show. If it is displayed, it is true.

How to apply: a widget is classified by the **value shape** it reads (number, several numbers, choice, boolean, colour, vector, seed, state, change log, loop clock, frame) — the same rule as `QUICK_ADD_KINDS`, so swapping an option for a real-time probe of the same shape changes nothing in the widget. The existing kinds map onto the catalogue as: sparkline, swatch, vector, crosshairs, badge (kept), gauge → VU with peak hold, counter → rolling odometer, readout → decoding text (evolutions); bounding-box is untouched.

**Determinism trap, not yet paid**: the study runs the accent decay, the springs, the peaks and the trails on wall-clock time. In the app they must advance on the loop clock / frame number like `hud/history.js` already does, or two exports of the same frame differ (`architecture.md`, deterministic capture).

## The selection UI (proposed 2026-10-09, awaiting the maintainer)

A working studio mock (artifact "Sélecteur HUD") proposes, for validation — nothing here is decided yet:

- **Style is three settings written into every HUD layer** — ink (auto from the sketch background's luminance / light / dark), accent (ice, amber, rose, ink only), edge veil. It deliberately does **not** reintroduce an inheriting container (rejected 2026-08-31, `studio-ui.md`); it is a batch write like "Apply … to all HUD layers", and a new layer is seeded with the current style.
- **Composition presets** (Empty / Calm / Signal / Dense) are a starting set of layers; replacing existing HUD layers asks for an inline confirmation.
- **Add flow is source → instrument → zone**: the source list is grouped (sketch options, document & loop, probes later), the instrument grid shows only what that shape can read, live, with a suggestion derived from the option schema (unit `°` → dial, step < 0.01 → vernier, integer → odometer, 0..1 → VU, else arc).
- **Nine named zones** (4 corners, top/bottom edges, stackable left/right flanks of 3, full frame); a zone maps to the existing `anchor` plus a rank, and the on-canvas drag keeps writing `offset`.
- **Every control gets a visible gauge button** (right-click quick-add is undiscoverable on touch) showing live compatible instruments and a badge counting the layers already showing that option.
- Clicking a widget on the canvas selects its layer; with a layer selected, clicking another zone moves it there.
