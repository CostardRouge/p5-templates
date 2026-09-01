# Interaction bindings — modulating a sketch parameter

The per-field modulation system: a "binding" says *drive this sketch parameter from this signal*. Read this before touching `src/sketches/p5/utils/interaction/bindings.js` (the resolver), `BindingAffordance/` (the pastille + popover) or the source manifest.

## The model, and what it deliberately is not

2026-08-31 — A binding is **serializable data resolved at READ time**, never written into the store: `resolveBindings` returns a modulated *clone* of the options, so the form, undo/redo, persistence, "save defaults", randomize and the exported JSON only ever see the base value the user set. It lives in the `interactive` namespace paired with the sketch scope (`interactive.bindings`, `slides.N.interactive.bindings`), **outside** `sketch`, so binding data cannot leak into sketch parameters. `interactive` is `z.any()` in `OptionsSchema` on purpose — the shape belongs to the plugin, so a new binding field needs no schema change.

2026-08-31 — The whole feature is off unless `INTERACTION_BINDINGS=true` (exposed as `NEXT_PUBLIC_INTERACTION_BINDINGS`). To see any of it locally: `INTERACTION_BINDINGS=true npm run dev`. A field renders no affordance at all when the flag is off, and none for a non-sketch path — `getSketchScope` returns null for canvas/animation/content-item fields, which is why the size and duration controls have no pastille. Widening binding beyond sketch parameters means changing that function, not the affordance.

## The five families

2026-08-31 — Everything upstream of the mapping is shared: source (input channel or generator) → projection → invert → curve gives one 0..1 signal. A `kind` only decides what that signal becomes, and how layers fold:

| kind | target | mapping | folding |
| --- | --- | --- | --- |
| `continuous` | number | `min`/`max` lerp | numeric, all blend modes |
| `vector2d` | `{x,y}` | per-axis `min`/`max` | per axis, all blend modes |
| `boolean` | boolean | `threshold` + `hysteresis`, `mode: gate \| toggle` | as 0/1, re-thresholded → `max` is OR, `min` is AND |
| `enum` | one option value | `values` (the option list, in order) | last layer wins; blend and weight are hidden, not ignored silently |
| `color` | `[r,g,b,a]` | `from` → `to` two-stop ramp | per component, all blend modes |

Consequences worth knowing before extending it:

- **`vector2d` is the only kind that needs a real channel**; every other kind runs off a generator, so the source-category selector is gated on `kind !== "vector2d"`, not on `continuous`.
- **An enum binding carries its option values.** The resolver runs in the engine, where no form config exists, so `mapping.values` is copied from the field at bind time. A field whose options changed later keeps the old list — the popover prints the values it will actually cycle, by label where it still matches, so the drift is visible rather than silent.
- **Smoothing lags the signal, not the output, for boolean/enum/color** (`SIGNAL_SMOOTHED_KINDS`): you cannot average a boolean or an option value, and for a two-stop colour ramp it is the same result more cheaply. It also reads better — smoothing on a boolean means "how long before it flips".
- **Boolean is stateful** (Schmitt trigger, and toggle counts rising edges), keyed by binding id in a module map like the smoothing state. It advances once per resolve, which `resolveBindings`' frame memo makes once per frame; capture stays reproducible because headless runs render frames in order from 0.
- **Defaults are chosen so a first click is legible**: a new binding starts on a generator (no device, no permission, no interaction block), and the wave matches the family — square for a boolean blink, sawtooth to walk an enum in order, sine to crossfade a colour. A colour ramp starts at the colour already on the field and ends at its complement, with mid-greys pushed to the opposite end of the greyscale so the ramp is never invisible.

## What is still not bindable, and why

2026-09-01 — Five kinds exist; the gaps are known and listed in `TODO.md` under *Input / Interaction*. Two are worth knowing before someone re-derives them:

- **The 2D pad cannot run off a generator.** Generators emit one scalar, and `mapVector` reads a channel's `x`/`y`, so `channelSourceOptions( "vector2d" )` offers only the fourteen vector2d input channels and the popover hides the category selector for that kind. Of those channels, **Orbit** (a Lissajous off `animation.angle`, so a pure function of the loop clock) and **Perlin noise** (an offset advanced once per `frameCount`) animate with no device and survive capture; everything else needs a mouse, a camera, a mic or a controller. Giving the pad real generators means one generator per axis on a shared clock with a phase offset — not a single wave.
- **Easing, asset and text targets have no kind yet**, and easing/asset are the cheap ones: both are "pick one value from an ordered list", which is exactly the enum fold rule once the list is copied onto the binding.

Widening *targets* (content items, canvas size, duration) is a different axis from adding a kind — it is `getSketchScope`, not `bindingKindFor` — and is held back on purpose: modulating size or framerate would fight the capture pipeline.

## Popover chrome matches the form's own control-bar style

2026-09-01 — The popover's selects (`Category`, `Wave`, sequence/boolean `Mode`, layer `Blend`) were plain native `<select>`s styled ad hoc (`h-8 rounded-md`), diverging from every other select-like control in the panel — `ControlledFormatSelect`, `ControlledEasingInput` and the rest all wrap a `CONTROL_BAR_CLASS` div (`rounded-lg`, `h-10 md:h-7`) with a `BarLabelSegment`, a truncated value + `CONTROL_CHEVRON_CLASS` chevron, and an invisible native `<select>` laid over the top for the real interaction. Fixed by adding a local `BarSelect` helper in `BindingAffordance.tsx` that reuses that exact chrome, plus re-skinning the bespoke input-source picker (which needs its own richer "Family · Detail" closed-state label, so it isn't a `BarSelect`) the same way. The "Reset all" header button was also switched from a one-off `rounded`/`h-5 w-5` button to the shared `CONTROL_RESET_BUTTON_CLASS`. The popover panel itself (`rounded-xl border-theme bg-background shadow-xl z-[60]`, Headless-UI `anchor="bottom end"`) already matched `AddLayerPopover`'s convention and was left alone; it now also carries `max-h-[70vh] overflow-y-auto` since a multi-layer binding with a long generator config can otherwise run off-screen, mirroring the scrollable body in `SketchSettings.tsx`'s docked rail/floating card. **Apply when extending the popover** (see "Adding a kind" below): any new one-line select goes through `BarSelect`, not a raw `<select>`.

## Adding a kind

2026-08-31 — Four aligned edits, and the last one is the one that gets forgotten: (1) a `mapXxx` in `bindings.js` plus its branch in `bindingValue`, (2) a fold rule in `foldTarget`, (3) `bindingKindFor` in `bindingUtils.ts` — the single list of which form components are bindable, read by both `FieldRenderer` and the affordance — and (4) the mapping controls in the popover, plus the per-kind defaults in `makeDefaultBinding` **and** `defaultMapping`/`defaultSmoothing` in the affordance (the reset button and the per-control reset arrows both read the latter, and they must agree with the former).

The affordance's placement is per-control and already decided: bar controls (slider, number, select, colour) take it inline beside the bar via `inlineBinding`, the checkbox row places it before its switch, the 2D pad in its outer label row.
