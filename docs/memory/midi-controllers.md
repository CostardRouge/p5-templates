# MIDI controllers — abstract controls, the port map, pads, LEDs

How a physical controller reaches a field: a sketch declares an abstract
`control`, the open PORT resolves it, a pad is a channel, a button is a write,
and the engine owns the output. The binding model, its kinds, the learn gesture
and the channel manifest are in `interaction-bindings.md`; the collectors that
turn a device into a pointer are in `interaction-sources.md`. Measured ground
truth and the task register are in `TODO.md`, "MIDI controllers".

## An abstract control, declared by the sketch or learned by hand

2026-09-17 — A field config can carry `binding: { control: "knob.1" }`
(`BaseConfig`, beside `managed`). `control` is an **abstract address** naming no
device, port or CC number, so the vocabulary can later reach `axis.left-x`,
`band.bass` or `lfo`. Rejected: a `midi-slider` component kind — here `component`
describes the CONTROL, never a data source, and a source-flavoured kind would
multiply once per field type.

**A pad is a scalar channel, `midi.note<n>`, minted like the CCs** (2026-09-23).
`_midiNoteLevels` in the handler holds velocity while held and **0 after
release — set, never deleted**: the falling edge is the signal a boolean gate
needs and what lets a trigger re-arm. `_midiNotes` (release = delete) stays
untouched because the spatial fold only wants what is down. `controllerMap.js`
numbers pads by PANEL position (`pad.1` top-left … `pad.16`), so `pad.1` is the
same physical pad on both ports though it sends note 40 on one and 96 on the
other; `padSequence( port, "pad.1", n )` hands a row of buttons its n
consecutive channels and a bare `"pad"` means `pad.1`. **How to apply**: a
boolean field declaring `binding: { control: "pad.9" }` already toggles on that
pad with no other code — the existing `toggle` mode of `mapBoolean` sees the
rising edge.

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
- Pads are `pad.1` … `pad.16` in the same `controls` map (see "A pad is a
  scalar channel" above). `104` is a *round pad* the Mini MK3 lacks: the DAW
  rows are 96-103 and **112**-119, not contiguous.
- **The engine owns the output and always disarms** (2026-09-23). The output is
  paired with the input BY NAME (a Launchkey exposes both as "… DAW Port"),
  armed with `9F 0C 7F` when the map says `requiresArming`, and released —
  every lit pad off, then `9F 0C 00` — from `_clearMidiState` (reset, dispose,
  device switch) and from `pagehide`, because a keyboard left in DAW mode after
  the tab closes stays dark and silent until power-cycled. LED wishes cross
  from the editor through `@/lib/padLedBridge` keyed by abstract control
  (`usePadLeds` publishes, one owner per field); `_flushPadLeds` runs inside
  `_collectMidi`, compares the wish list by identity, and sends only the diff
  (`padLeds.js`, pure). Velocity indexes a **128-colour palette**, not free
  RGB; only 0 / 1 / 9 are measured (`PAD_COLORS`). The channel follows the pad
  LAYOUT — session (notes 96+) uses 1/2/3 for static/flash/pulse, drum (36-51)
  uses 10/11/12 — and **flashing alternates between the colour already on the
  pad and the one in the message** on a MIDI clock, so "off" always goes out
  on the static channel, which is also what stops a flash or a pulse.
- **A pad press is an editor event, not a signal** (2026-09-23). `usePadTrigger`
  diffs the pad's `midi.note<n>` level frame to frame from `subscribeChannels`
  (a Schmitt: fires above 0.5, re-arms below 0.25, never on release, a pad
  already down at mount is waited out) and calls the button's own click
  handler; a select in `display: "buttons"` gets `padSequence` consecutive
  pads, option i on pad first+i. Nothing goes through `resolveBindings`, so
  there is no capture policy to write: no hands in a headless run, no pads.
