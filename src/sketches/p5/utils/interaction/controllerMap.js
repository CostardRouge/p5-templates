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

// One `midi.note<n>` channel id per pad, reading order: the top row left to
// right is pad.1 … pad.8, the bottom row pad.9 … pad.16. The pad numbering is
// the PANEL's, not the note's, so `pad.1` is the same physical pad on both
// ports even though it sends note 40 on one and 96 on the other.
function pads( noteNumbers ) {
  const controls = {};

  noteNumbers.forEach( (
    note, index
  ) => {
    controls[ `pad.${ index + 1 }` ] = `midi.note${ note }`;
  } );

  return controls;
}

// The LED palette indices that were MEASURED to light a Launchkey Mini MK3 pad
// — sent as the velocity of a note-on to the pad's note. Only these three are
// known: 0 turns the pad off, 1 is a dim white, 9 an orange. The rest of the
// 128-entry palette is documented for the Launchpad, not verified here, so it
// is deliberately not listed. A field can still ask for any index through
// `binding.led`.
export const PAD_COLORS = {
  off: 0,
  idle: 1,
  active: 9
};

export const CONTROLLER_MAPS = {
  // Always live, whatever the keyboard is doing. CC on channel 1.
  "Launchkey Mini MK3 MIDI Port": {
    label: "Launchkey Mini MK3 (MIDI)",
    requiresArming: false,
    controls: {
      ...knobs( [
        29,
        79,
        80,
        104,
        109,
        108,
        113,
        112
      ] ),
      ...pads( [
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
      ] )
    },
    // Measured: the pads land in the drum layout on this port. Whether their
    // LEDs answer a note-on here has not been checked — the DAW port's have.
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
    controls: {
      ...knobs( [
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28
      ] ),
      ...pads( [
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
      ] )
    },
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

// The inverse of `resolveControl`: `( "… DAW Port", "midi.cc21" )` → `"knob.1"`.
//
// What lets a LEARNED binding be stored as an abstract control rather than the
// raw channel it was captured on. The binding then survives the user switching
// port — the same portability a declared control has — instead of going inert
// the moment the numbers change underneath it. Null when nothing on this port
// emits that channel, and the caller then stores the raw channel.
export function controlForChannel(
  portName, channelId
) {
  const map = controllerMapFor( portName );

  if ( !map || typeof channelId !== "string" ) {
    return null;
  }

  const hit = Object.keys( map.controls ).find( ( control ) => map.controls[ control ] === channelId );

  return hit ?? null;
}

// Whether this port stays silent until `9F 0C 7F` is sent to it. Used to tell
// "nothing is plugged in" apart from "nothing is armed", which are the same
// silence but not the same problem.
export function portRequiresArming( portName ) {
  return controllerMapFor( portName )?.requiresArming === true;
}

// The 1-based pad number a control names, or null: `"pad.9"` → 9, and a bare
// `"pad"` → 1, so a field can say "the pads, from the first" without picking.
function padIndexOf( control ) {
  if ( typeof control !== "string" ) {
    return null;
  }

  if ( control === "pad" ) {
    return 1;
  }

  const match = /^pad\.(\d+)$/.exec( control );

  return match ? Number( match[ 1 ] ) : null;
}

// `( port, "pad.1", 8 )` → the channel ids of eight CONSECUTIVE pads starting
// at that one, in reading order — what a select rendered as a row of buttons
// needs: option i is driven by pad first+i, and no field ever spells a note.
// Truncated at the last pad rather than wrapped, so a 12-option row on a
// 16-pad grid starting at pad.9 drives what it can and leaves the rest to the
// mouse. Null when the port is unknown or the control is not a pad.
export function padSequence(
  portName, control, count
) {
  const map = controllerMapFor( portName );
  const first = padIndexOf( control );

  if ( !map || first === null || !( count > 0 ) ) {
    return null;
  }

  const ids = [];

  for ( let index = first; index < first + count; index++ ) {
    const id = map.controls[ `pad.${ index }` ];

    if ( !id ) {
      break;
    }

    ids.push( id );
  }

  return ids;
}

// `( port, "pad.1" )` → the NOTE NUMBER that pad answers to — what lighting its
// LED needs, since the LED is addressed by the same note the pad sends. Null
// when the port is unknown or the control is not a pad on it.
export function padNoteFor(
  portName, control
) {
  const map = controllerMapFor( portName );
  const index = padIndexOf( control );

  if ( !map || index === null ) {
    return null;
  }

  const note = map.padNotes[ index - 1 ];

  return typeof note === "number" ? note : null;
}
