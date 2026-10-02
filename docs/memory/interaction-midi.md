# Interaction bindings — MIDI channels, learn, declared controls

How a MIDI controller becomes a binding source: CC channels minted at runtime, the learn gesture, the abstract `control` a sketch declares or a learn stores, and the port-name map that resolves it. Split out of `interaction-bindings.md` (2026-10-02); the binding model itself, the absence rule and the per-field UI stay there.

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
