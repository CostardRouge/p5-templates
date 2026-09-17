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

## A live channel that is not there publishes nothing — never a zero

2026-09-16 — The capture-safety policy for every device-backed channel, and it is a rule about *absence*: a channel with no live value is **omitted from the snapshot**, not published as 0. `bindingValue` returns null for a missing channel and `foldTarget` leaves the parameter on its base value, so a binding on an unplugged device is inert rather than pinning the parameter to the bottom of its range — which is exactly what makes a headless export reproducible without the hardware. `audio.*` already worked this way by accident of its guard (no mic → `getAudio().bands` is null → no channels); `midi.cc*` follows it deliberately, per CC: an untouched knob has no entry in the controls Map and therefore no channel. **How to apply**: a new live channel publishes only values it actually has, and `prepareCapture` needs no new gate for it (it waits on vision only, because a camera *will* produce frames and needs warming; a knob nobody turned never will).

## A channel family can be minted at runtime — the picker reads the live snapshot

2026-09-16 — `0xB0` messages fill a `_midiControls` Map (CC number → raw 0–127) beside `_midiNotes` in `interaction/index.js`, cleared with them in all three paths (`initInteraction`, `disposeInteraction`, and the runtime device switch in `_collectMidi` — a knob position from a device we stopped listening to is as stale as a held note). `channelsAdapter.midiControlChannels` divides by 127 and publishes **one `midi.cc<n>` per CC number actually received**, plus `midi.ccLast` for the one that moved most recently.

**A fixed set of CC numbers cannot work, and this is the evidence**: a Novation Launchkey Mini's eight pots send CC **29, 79, 80, 104, 109, 108, 113, 112** — not contiguous, and not even in panel order (pot 6 is a lower number than pot 5). The first implementation declared `midi.cc1 … midi.cc8` in the manifest, reasoning that CC 1–8 are the widely-assigned low controllers; on real hardware it caught **nothing**, and only `midi.ccLast` worked. Do not reintroduce a guessed list for any device family — grow the channel set from what arrives.

The id is still the CC *number* (`midi.cc29`), never a slot numbered by arrival order: a slot would not survive a reload, so a saved binding would silently address a different knob next session.

What that costs on the UI side, and where it lands:

- **`channelSourceOptions( kind, extra )` / `channelSourceGroups( kind, extra )` take the live ids** as a second argument and stay pure — nothing in `bindingUtils.ts` reads the snapshot itself, which is what keeps them unit-testable. Runtime ids are appended after the manifest, so the grouping pass drops each into the family group the manifest already opened; they sort by the *number* in the id, because a string sort puts `midi.cc113` before `midi.cc29`.
- **`describeChannel( id )` names a channel the manifest never declared** (`midi.cc29` → "MIDI · CC 29"). `bindingSourceLabel` goes through it too, or every bound knob collapses to "MIDI" in the mixer rows.
- **`useLiveChannels.ts` is the first consumer of `channelBridge`'s pub/sub**, which existed with no caller and a comment predicting exactly this use. Two rules it encodes: compare the **set of ids** and re-render only when one appears or disappears (a snapshot lands every frame; turning that into React state per frame is the reconciler thrash the bridge's CSS vars exist to avoid), and mount the hook *inside* the popover panel so nothing is subscribed while no picker is open. A hook like this is tested with `renderHook` plus real `publishChannels` calls wrapped in `act` (`__tests__/useChannelLearn.test.tsx`, `@jest-environment jsdom` — the project default is `node`); a probe component that assigns the hook's result to an outer variable is an ESLint **error** here, not a style preference.
- **`withSelectedSource` guarantees the binding's own source is in the list.** A runtime channel only exists while it is publishing, so after a reload `midi.cc29` is gone until that knob is touched. The `<select>` is React-controlled: a value with no matching `<option>` leaves the native control showing the first entry while the label beside it still reads the saved source, and the next change event writes whatever the browser was displaying over the user's binding. The synthesized option carries a "(not arriving)" marker so a remembered channel is not mistaken for a live one.

**The trap that costs a dead source**: a new dotted channel family also needs a branch in `interactionEnablePaths` (`BindingAffordance/bindingUtils.ts`). Its `switch` matches whole ids, so `midi.cc1` fell through to `default` → `[]`, and picking it in the popover would not switch `interaction.midi.enabled` on — the pastille shows a source that never produces a value, with nothing to suggest why. Four aligned edits, then: the collector in `channels.js`, the enable-paths branch, `describeChannel`, and the live-id source for the picker.

## Learn is a diff of the snapshot — and a mirror channel will always beat the knob

2026-09-16 — The gesture (arm, move a control, it is assigned) is `observeForLearn` in `bindingUtils.ts` plus `useChannelLearn` in `useLiveChannels.ts`. It does **not** read `midi.ccLast`, which carries the value and never the number: it diffs consecutive snapshots and takes the scalar that has travelled furthest from where it was **first seen** since arming. First-seen rather than arm-time is what makes a runtime channel learnable at all — `midi.cc113` does not exist until the knob moves, so it has no arm-time value. The consequence, which reads as a bug until you know it: **one message cannot learn a knob**, because the first message only seeds the reference. That is correct, and it is also why learn is generic — a fader, an audio band or a hand gesture is learned the same way, with nothing MIDI-specific in the scoring.

**A channel computed from another can never win a "what moved" test, and must be excluded.** `midi.ccLast` mirrors whichever CC moved last, so it moves in exact lockstep with the knob being turned — and, carrying a jump from the *previously* moved control's value, it usually moves further. Learn duly assigned "MIDI · Last moved CC" instead of `midi.cc79`, which is the precise opposite of the stable assignment learn exists to produce. `audio.level`, the mean of the bands, is the same shape of mistake. The fix is data, not a special case: `derived: true` on those descriptors in `sources.js`, and `observeForLearn` skips them. **How to apply**: any new channel that mirrors or aggregates other channels carries that flag, or it silently swallows every learn.

Three more things the build settled:

- **Arming enables the MIDI source, and only that one.** `sampleChannels` gates MIDI on `interaction.midi.enabled`, and a fresh binding has no `interaction` block at all until `enableSourceInputs` seeds one — arm without that and the knob turns into nothing. MIDI is the family whose channels cannot be listed ahead of time and the only one that costs no camera or microphone permission, so it is the one arming turns on; every other family is already in the list to be picked by hand.
- **A paused sketch publishes no snapshot**, because `publishChannelsFrame` runs on `pre-draw` — learn is then dead with nothing on screen to say why. Rather than reaching for the play state, the hook reports whether frames are arriving at all (`seenSignal`, false until the first publish) and the bar reads "No frames — is it paused?". The seed deliberately reads the cached snapshot *without* going through the subscriber, or a paused sketch's last frame would look like a live signal.
- **Learn's responsiveness is frame-rate bound.** It needs a few frames of movement, which at 60fps is ~50ms of turning and invisible; on a heavy sketch it is not. There is no timeout — armed stays armed until it captures, is pressed again, or the popover closes — because a timeout firing while someone reaches for a knob is worse than a lit button they can see.

**Verifying one needs no hardware.** Stub `navigator.requestMIDIAccess` through Playwright's `addInitScript` with a fake access object whose `inputs` is a `Map` (its `forEach` already yields `( value, key )` like `MIDIInputMap`), then push `new Uint8Array( [ 0xb0, cc, value ] )` into the fake input's `onmidimessage` — that drives the real handler, channel layer and resolver. Read `--ch-midi-cc<n>` and `--bind-<target>` off `:root` (`channelBridge` writes both every frame) to watch the normalized channel and the resolved signal without decoding a single pixel; the CSS var being *empty* is how you see the absence rule above holding, and enumerating `document.documentElement.style` for `--ch-midi*` is how you see which channels a sweep minted. The picker's own list can be read the same way, off the `<option>` values under `select[aria-label="Source"]`'s MIDI `<optgroup>`.

Two things about the empirical setup, both paid for:

- **Pick a parameter that dominates the image, and values that separate it.** `noise-grid-v1-basic`'s `grid.rows` at 1 versus 500 reads ~99% versus ~77% ink coverage, well clear of the noise field's own drift. Its `stroke.weightMin` proves nothing — at 189×119 the strokes already blanket the canvas, so coverage *and* mean luminance both sit inside that drift. And comparing two values that map to a similar row count (98 versus 127 → ~385 versus 500 rows) is the same dead end with the right parameter. The check worth running is the **isolation** one: bind pot 7, sweep it 0 → 127, then move pot 1 and confirm the bound parameter does not budge.
- **The headless browser draws at ~1 fps, and that invalidates any test that paces input by wall-clock.** Under SwiftShader `noise-grid-v1-basic` rAFs about once a second, so messages sent 150–600ms apart all land between two frames: a knob's channel then *appears already at its final value*, is seeded there, and looks motionless to learn. Two wrong diagnoses came out of that — "the re-arm never subscribes", then "the derived fix broke it" — before measuring the rate settled it. Measure the rate (a rAF counter over 3s) before blaming the code, and pace a simulated gesture across several frames (~400ms per step, a dozen steps) the way a hand actually turns a knob.
- **Kill the previous `next start` before rebuilding.** A running server whose `.next` is replaced under it serves 500s for every route while still answering `/sketches` with a 200, so a readiness poll says "up" and the run fails 60s later on a missing canvas. `npm start` on the busy port fails with `EADDRINUSE` into its log, silently if it was backgrounded, and `next start` leaves a `next-server` child that outlives the `npm` parent — kill that too.

## Binding UI chrome matches the rest of the panel's own conventions

2026-09-01 — Both binding-editing surfaces had drifted from house style the same way: ad hoc sizing/radius instead of the shared primitives the rest of the sketch-options panel already uses. Fixed in both; the underlying rule going forward is **reach for the shared primitive, never restyle by hand**.

- **`BindingAffordance.tsx` popover** — its selects (`Category`, `Wave`, sequence/boolean `Mode`, layer `Blend`) were plain native `<select>`s styled ad hoc (`h-8 rounded-md`), diverging from every other select-like control in the panel — `ControlledFormatSelect`, `ControlledEasingInput` and the rest all wrap a `CONTROL_BAR_CLASS` div (`rounded-lg`, `h-10 md:h-7`) with a `BarLabelSegment`, a truncated value + `CONTROL_CHEVRON_CLASS` chevron, and an invisible native `<select>` laid over the top for the real interaction. Fixed with a local `BarSelect` helper that reuses that exact chrome, plus re-skinning the bespoke input-source picker (which needs its own richer "Family · Detail" closed-state label, so it isn't a `BarSelect`) the same way. The "Reset all" header button was also switched from a one-off `rounded`/`h-5 w-5` button to the shared `CONTROL_RESET_BUTTON_CLASS`. The popover shell itself (`rounded-xl border-theme bg-background shadow-xl z-[60]`, Headless-UI `anchor="bottom end"`) already matched `AddLayerPopover`'s convention and was left alone; it now also carries `max-h-[70vh] overflow-y-auto` since a multi-layer binding with a long generator config can otherwise run off-screen, mirroring the scrollable body in `SketchSettings.tsx`'s docked rail/floating card. **Apply when extending the popover** (see "Adding a kind" below): any new one-line select goes through `BarSelect`, not a raw `<select>`.
- **`InteractivePanel.tsx` mixer** (the "Interactive · N layers" floating card, one row per binding) — its rows used bespoke fixed 24px boxes at the wrong radius (`rounded`, not `rounded-md`), an unlabeled weight slider crushed into a 64px column, and a plain-text group header, none of which matched the sibling `ContentLayers/LayerRow.tsx` list this panel sits next to. Fixed: the meter chip and the mute/solo/remove buttons are now uniform `h-7 w-7 rounded-md` (matching the popover's own pastille sizing), the weight slider is full-width with a real "Weight" label (same `ControlledSliderInput` used everywhere else, just no longer starved for room), and the group header reuses `LayerGroup.tsx`'s own small-caps `text-[0.6875rem] uppercase tracking-[0.08em] text-label/70` treatment plus its item-count badge, rather than a plain `text-label` span.

2026-09-01 — **The mixer's font also read oversized against the rest of the form**, and the cause was not a font-size class at all: `ItemListRenderer.tsx` wraps the whole Controls-rail field list in a single `text-xs` div, which every bar control (`CONTROL_BAR_CLASS`, `BarLabelSegment`, …) relies on by never setting its own text size. `InteractivePanel` is mounted as a sibling floating card outside that subtree, so its rows fell back to the browser/body default instead — nothing in the component looked wrong on inspection, since the same shared primitives were now in use (see above); the mismatch was purely about which ambient `text-xs` wrapper a given tree sits under. Fixed by setting `text-xs` once on the mixer's own root div. **Trap for later**: any panel that floats independently of `OptionsPanel`'s subtree (i.e. isn't inside `ItemListRenderer`'s wrapper) must set its own `text-xs` — don't assume inherited sizing just because sibling panels look right.

2026-09-01 — **The floating (non-docked) mixer now stacks directly above the Controls card** instead of floating bottom-center over the canvas, both `w-80` and left-aligned at `left-4`. This uses plain CSS flow, not measured/computed pixel offsets: `SketchOptions.tsx` wraps `InteractivePanel` (new `stacked` prop — renders as an unpositioned flex child instead of self-positioning) and `SketchSettings`' floating card (which lost its own `absolute`/`ISLAND_BOTTOM` positioning — the caller now owns it) in one shared `absolute left-4 flex-col` column anchored only by `bottom`; document order stacks the mixer above Controls regardless of how tall Controls' expanded sections make it, with zero `ResizeObserver`/height-measurement code. Docked mode is unaffected and intentionally different: `SketchSettings` there is a full-height rail with no room to stack above, so the mixer keeps its original standalone centered-bottom float (`bottomOffset={mixerBottom}`, `stacked` omitted). **Apply when adding another floating panel that must sit above/below an existing island**: reach for this same shared-flex-column pattern (already precedented once more on the right rail: banner + `OptionsPanel` + `SlideFilmstrip` in one `space-y-2` column) rather than computing a bottom offset by hand.

## An abstract control, declared by the sketch or learned by hand

2026-09-17 — A field config can carry `binding: { control: "knob.1" }`
(`BaseConfig`, beside `managed`). `control` is an **abstract address** naming no
device, port or CC number, so the vocabulary can later reach `axis.left-x`,
`band.bass` or `lfo`. Rejected: a `midi-slider` component kind — here `component`
describes the CONTROL, never a data source, and a source-flavoured kind would
multiply once per field type.

**A learned binding carries the same `control`.** The crosshair — and the
context-menu entry that arms the same `useChannelLearn` hook — captures a
channel id, then stores the abstract control the connected port maps it back to
(`controlForChannel`), falling back to the raw channel when no map matches. That
is what makes a hand-made binding survive a port switch: a Launchkey's knob 3 is
cc80 on its MIDI port and cc23 on its DAW port, and only `knob.3` is true on
both. Two rules the gesture follows: on an already-bound field it replaces the
**source only**, keeping the range, curve and smoothing that were set by hand;
and since the context menu closes on click, the **field itself** has to show it
is listening, or a knob that does nothing reads as a fault. It stays a shortcut
for the one tedious step and never a second editor — easing, smoothing and the
rest are still only in the popover, which is also the only way to reach a
generator, since a learn can capture a channel and nothing else.

**Arming a learn means switching the source on FIRST — `armLearnForField` before
`learn.arm()`, never the reverse.** Enabling on capture cannot work: without
`interaction.midi.enabled` the handler never calls `requestMIDIAccess()` at all,
so no CC channel is ever published and there is nothing to diff. It is invisible
on any document where MIDI was already on, which is every document one tests on
after the first. Two neighbouring traps, both of which read as that same "learn
is broken": `seenSignal` flips on the first frame published **whatever it
contains** — `sampleChannels` always emits `mouse` — so it says "frames are
arriving", never "a learnable channel exists"; and the affordance must be hidden
for `vector2d`, because `observeForLearn` returns only scalars, so a 2D pad arms
and waits forever. The popover hides its own crosshair for that kind.

**Declared ones resolve at read time and are NEVER written to the document.**
`effectiveInteractive` (`options.js`) appends them inside the ephemeral array it
hands `resolveBindings`; nothing writes back. Persisting them would put one
machine's CC numbers into the saved JSON, the export and `/embed`, dirty the form
on every reconnect, and be wiped anyway — `mergeChangedInPlace` treats arrays as
leaves, so the next form push replaces `interactive.bindings` wholesale. **How to
apply**: anything derived from the hardware present goes through
`@/lib/declaredBindings` (a module singleton, like `audioBridge`), never the
option store.

- **Declared bindings go FIRST.** `foldTarget` layers by target in order, so a
  hand-authored binding lands last and wins: a declaration is a default, never an
  override.
- **Their `id` is derived, not minted** (`declared:<control>:<target>`). Smoothing
  and trigger state is keyed by `id`, so `makeDefaultBinding`'s fresh
  `randomUUID` would reset it every frame. That helper is still the right source
  for the *mapping* — it alone derives a range from a slider's min/max or a
  select's option list — but its `source` and `id` are discarded.
- **The port name travels on `channelBridge`**, published by the engine each
  frame beside the channel snapshot. The editor needs it to turn a learned
  channel back into a control, and must not import the interaction handler to
  get it — that drags MediaPipe into the editor bundle.
- **The walk belongs to React.** The engine sees values, never the form config
  carrying the keys (same reason an enum binding transports its option list).
  `collectDeclaredBindings` follows only the LIVE branch of a `conditional-group`;
  walking every branch would let two claim the same knob.

## The MIDI port decides the map — there is no mode to detect

2026-09-17 — `@/p5/utils/interaction/controllerMap.js` maps a **port name** to
channel ids. Keyed on the port because a controller publishes several at once and
they disagree: a Launchkey Mini MK3 exposes `… MIDI Port` and `… DAW Port`
permanently, and the same eight pots send CC 29, 79, 80, 104, 109, 108, 113, 112
on the first and CC 21-28 on the second. The DAW port is **silent until armed**
with `9F 0C 7F` — a plain Note On, so no SysEx and no extra permission prompt.
Measured on the hardware; the manual documents only the DAW set and gets the
factory one wrong.

- **The map resolves, it never mints.** An alias channel would need
  `derived: true` — the flag excluding a channel from MIDI learn — so it would be
  unlearnable. Resolving to the existing `midi.cc<n>` leaves the channel layer
  untouched.
- **A port name is required**: `getMidiDeviceName()` answers `""` while
  `deviceId` is `""` (every input at once), because two open ports give no single
  name and the wrong map addresses the wrong knob in silence. Match exact then
  case-insensitive, **never by prefix** — "Launchkey" must not claim an
  unmeasured model.
- Pad notes are recorded there though nothing reads them yet (driving an action
  from a pad needs the `component: "action"` kind that `TODO.md` still lists).
  `104` is a *round pad* the Mini MK3 lacks: the DAW rows are 96-103 and
  **112**-119, not contiguous.
- LEDs later: velocity indexes a **128-colour palette**, not free RGB, and the
  channel follows the pad LAYOUT — session (notes 96+) uses 1/2/3 for
  static/flash/pulse, drum (36-51) uses 10/11/12. **Flashing alternates between
  the colour already on the pad and the one in the message** and follows a MIDI
  clock, so a lone channel-2 message alternates with whatever was there and looks
  erratic; a static-channel lighting message is also what STOPS a flash or pulse.

## Adding a kind

2026-08-31 — Four aligned edits, and the last one is the one that gets forgotten: (1) a `mapXxx` in `bindings.js` plus its branch in `bindingValue`, (2) a fold rule in `foldTarget`, (3) `bindingKindFor` in `bindingUtils.ts` — the single list of which form components are bindable, read by both `FieldRenderer` and the affordance — and (4) the mapping controls in the popover, plus the per-kind defaults in `makeDefaultBinding` **and** `defaultMapping`/`defaultSmoothing` in the affordance (the reset button and the per-control reset arrows both read the latter, and they must agree with the former).

The affordance's placement is per-control and already decided: bar controls (slider, number, select, colour) take it inline beside the bar via `inlineBinding`, the checkbox row places it before its switch, the 2D pad in its outer label row.
