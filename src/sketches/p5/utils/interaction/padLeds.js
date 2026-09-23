// ── Pad LED messages, pure ──────────────────────────────────────────────────
// Turning the editor's wish list ("pad.3 orange, pad.4 dim") into the note-on
// messages a Launchkey wants, and only the ones that CHANGED since the last
// flush. Pure so it is tested without Web MIDI; index.js owns the output port
// and sends what this returns.
//
// A pad LED is addressed by the same note the pad sends, with the palette
// index as velocity. The MIDI channel picks the behaviour — measured on the
// DAW port: 1 lights the colour steadily, 2 flashes between it and whatever
// was there, 3 pulses it. A lighting message on channel 1 is also what STOPS
// a flash or a pulse, which is why "off" always goes out on channel 1.

export const LED_CHANNELS = {
  static: 1,
  flash: 2,
  pulse: 3
};

const NOTE_ON = 0x90;

// `[{ control, color, mode }]` + a resolver from control to note number →
// `{ [note]: { color, channel } }`. A control the port does not carry (a
// knob, an unknown port, a pad off the grid) resolves to null and is dropped:
// a wish the hardware cannot show is not an error.
export function desiredPadLeds(
  entries, noteFor
) {
  const desired = {};

  if ( !Array.isArray( entries ) ) {
    return desired;
  }

  for ( const entry of entries ) {
    const note = noteFor( entry?.control );

    if ( typeof note !== "number" ) {
      continue;
    }

    const color = Number.isFinite( entry.color )
      ? Math.max(
        0,
        Math.min(
          127,
          Math.round( entry.color )
        )
      )
      : 0;

    desired[ note ] = {
      color,
      channel: LED_CHANNELS[ entry.mode ] ?? LED_CHANNELS.static
    };
  }

  return desired;
}

// What to send to move the pads from `previous` to `desired`, and the state to
// remember for next time. Unchanged pads cost nothing — this runs every frame.
// A pad that left the wish list is switched off explicitly, on the static
// channel, so a flashing pad does not keep flashing after its field unmounts.
export function padLedDiff(
  previous, desired
) {
  const messages = [];
  const next = {};
  const before = previous ?? {};

  for ( const [
    key,
    wish
  ] of Object.entries( desired ?? {} ) ) {
    const note = Number( key );
    const was = before[ note ];

    if ( !was || was.color !== wish.color || was.channel !== wish.channel ) {
      messages.push( [
        NOTE_ON | ( wish.channel - 1 ),
        note,
        wish.color
      ] );
    }

    next[ note ] = wish;
  }

  for ( const key of Object.keys( before ) ) {
    if ( !( key in next ) ) {
      messages.push( [
        NOTE_ON,
        Number( key ),
        0
      ] );
    }
  }

  return {
    messages,
    next
  };
}

// Every "off" for the pads currently lit — what a teardown sends before it
// disarms, so the keyboard is not left glowing after the tab closes.
export function padLedsOff( previous ) {
  return padLedDiff(
    previous,
    {}
  ).messages;
}
