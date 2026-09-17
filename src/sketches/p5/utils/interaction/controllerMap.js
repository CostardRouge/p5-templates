// ── Known controller maps ───────────────────────────────────────────────────
// Which physical control on a named MIDI port emits which channel id. This
// module is PURE (no imports), like `sources.js`, so the React editor bundle
// can import it without pulling in the interaction handler.
//
// The key is the PORT NAME, not the device, because a controller can expose
// several ports at once and they do not agree. A Launchkey Mini MK3 publishes
// both "… MIDI Port" and "… DAW Port" permanently, and the same eight pots send
// completely different CC numbers on each — so the port, not a mode flag, is
// what decides the map. Measured on the hardware, not read off a manual: the
// DAW port is SILENT until it is armed with `9F 0C 7F`, and the factory numbers
// below are nothing like the ones Novation documents.
//
// This map RESOLVES, it never mints. An alias channel (`midi.knob1` mirroring
// `midi.cc21`) would have to carry `derived: true` — see `sources.js` — which
// is exactly the flag that excludes a channel from MIDI learn, so the alias
// would be unlearnable. Resolving an abstract control to the channel id that
// already exists keeps the channel layer untouched.
//
// `control` ids are deliberately device-agnostic: `knob.1` says nothing about
// MIDI, so the same vocabulary can later address a gamepad axis or an audio
// band. A sketch declares `binding: { control: "knob.1" }` on a field and never
// names a CC number.

// One `midi.cc<n>` channel id per encoder, left to right on the panel.
function knobs( ccNumbers ) {
  const controls = {};

  ccNumbers.forEach( (
    cc, index
  ) => {
    controls[ `knob.${ index + 1 }` ] = `midi.cc${ cc }`;
  } );

  return controls;
}

export const CONTROLLER_MAPS = {
  // Always live, whatever the keyboard is doing. CC on channel 1.
  "Launchkey Mini MK3 MIDI Port": {
    label: "Launchkey Mini MK3 (MIDI)",
    requiresArming: false,
    controls: knobs( [
      29,
      79,
      80,
      104,
      109,
      108,
      113,
      112
    ] ),
    // Measured, kept here rather than re-derived later: the pads land in the
    // drum layout on this port. Nothing reads these yet — driving an action
    // from a pad needs a `component: "action"` field type, which does not
    // exist (TODO.md, "Options: button field type").
    padNotes: [
      40,
      41,
      42,
      43,
      48,
      49,
      50,
      51,
      36,
      37,
      38,
      39,
      44,
      45,
      46,
      47
    ]
  },

  // Silent until armed. CC on channel 16, pads on channel 1 in the session
  // layout — which is also why its LED channels are 1/2/3 and not 10/11/12.
  "Launchkey Mini MK3 DAW Port": {
    label: "Launchkey Mini MK3 (DAW)",
    requiresArming: true,
    controls: knobs( [
      21,
      22,
      23,
      24,
      25,
      26,
      27,
      28
    ] ),
    padNotes: [
      96,
      97,
      98,
      99,
      100,
      101,
      102,
      103,
      112,
      113,
      114,
      115,
      116,
      117,
      118,
      119
    ]
  }
};

// The port name as the browser reports it, matched exactly first so two ports
// of the same device never collide, then case-insensitively because Web MIDI
// capitalisation is not guaranteed to be stable across platforms. Deliberately
// no fuzzy matching: naming a port "Launchkey" must not silently claim a
// different Launchkey model whose numbers we have never measured.
export function controllerMapFor( portName ) {
  if ( typeof portName !== "string" || portName === "" ) {
    return null;
  }

  if ( CONTROLLER_MAPS[ portName ] ) {
    return CONTROLLER_MAPS[ portName ];
  }

  const lower = portName.toLowerCase();
  const hit = Object.keys( CONTROLLER_MAPS ).find( ( name ) => name.toLowerCase() === lower );

  return hit ? CONTROLLER_MAPS[ hit ] : null;
}

// `( "Launchkey Mini MK3 DAW Port", "knob.1" )` → `"midi.cc21"`, or null when
// the port is unknown or the control is not on it. Null is the honest answer
// and callers drop the binding: a parameter left on its own value is better
// than one pinned to a channel that will never publish.
export function resolveControl(
  portName, control
) {
  const map = controllerMapFor( portName );

  if ( !map || typeof control !== "string" ) {
    return null;
  }

  return map.controls[ control ] ?? null;
}

// Whether this port stays silent until `9F 0C 7F` is sent to it. Used to tell
// "nothing is plugged in" apart from "nothing is armed", which are the same
// silence but not the same problem.
export function portRequiresArming( portName ) {
  return controllerMapFor( portName )?.requiresArming === true;
}
