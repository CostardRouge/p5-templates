/**
 * Tests for the known-controller map. Pure data plus two lookups, so it needs
 * neither the interaction handler nor Web MIDI — the same discipline as
 * `channelsAdapter`.
 *
 * Every number here was MEASURED on a Launchkey Mini MK3, not read off the
 * manual, which documents only the DAW-mode set and gets the factory one wrong.
 */
import {
  CONTROLLER_MAPS,
  controlForChannel,
  controllerMapFor,
  padNoteFor,
  padSequence,
  portRequiresArming,
  resolveControl
} from "../controllerMap.js";

const MIDI_PORT = "Launchkey Mini MK3 MIDI Port";
const DAW_PORT = "Launchkey Mini MK3 DAW Port";

describe(
  "controllerMapFor",
  () => {
    it(
      "matches a port name exactly",
      () => {
        expect( controllerMapFor( MIDI_PORT ) ).toBe( CONTROLLER_MAPS[ MIDI_PORT ] );
        expect( controllerMapFor( DAW_PORT ) ).toBe( CONTROLLER_MAPS[ DAW_PORT ] );
      }
    );

    it(
      "matches case-insensitively, since Web MIDI capitalisation is not stable",
      () => {
        expect( controllerMapFor( DAW_PORT.toUpperCase() ) ).toBe( CONTROLLER_MAPS[ DAW_PORT ] );
      }
    );

    it(
      "never matches a prefix: an unmeasured model must not inherit these numbers",
      () => {
        expect( controllerMapFor( "Launchkey" ) ).toBeNull();
        expect( controllerMapFor( "Launchkey Mini MK4 DAW Port" ) ).toBeNull();
      }
    );

    it(
      "treats an empty or absent name as no controller",
      () => {
        expect( controllerMapFor( "" ) ).toBeNull();
        expect( controllerMapFor( undefined ) ).toBeNull();
        expect( controllerMapFor( null ) ).toBeNull();
      }
    );
  }
);

describe(
  "resolveControl",
  () => {
    it(
      "gives the two ports DIFFERENT channels for the same physical knob",
      () => {
        // The whole reason the map is keyed on the port: one device, one knob,
        // two answers depending on which port is being listened to.
        expect( resolveControl(
          MIDI_PORT,
          "knob.1"
        ) ).toBe( "midi.cc29" );
        expect( resolveControl(
          DAW_PORT,
          "knob.1"
        ) ).toBe( "midi.cc21" );
      }
    );

    it(
      "maps the factory bank in panel order, gaps and all",
      () => {
        const measured = [
          29,
          79,
          80,
          104,
          109,
          108,
          113,
          112
        ];

        measured.forEach( (
          cc, index
        ) => {
          expect( resolveControl(
            MIDI_PORT,
            `knob.${ index + 1 }`
          ) ).toBe( `midi.cc${ cc }` );
        } );
      }
    );

    it(
      "maps the DAW bank to the contiguous 21-28 range",
      () => {
        for ( let i = 1; i <= 8; i++ ) {
          expect( resolveControl(
            DAW_PORT,
            `knob.${ i }`
          ) ).toBe( `midi.cc${ 20 + i }` );
        }
      }
    );

    it(
      "numbers the pads by PANEL position, so pad.1 is the same pad on both ports",
      () => {
        // Top-left pad: note 40 in the drum layout, note 96 in the session one.
        expect( resolveControl(
          MIDI_PORT,
          "pad.1"
        ) ).toBe( "midi.note40" );
        expect( resolveControl(
          DAW_PORT,
          "pad.1"
        ) ).toBe( "midi.note96" );
        // Bottom row starts at pad.9 — 112, not 104, which is a round pad the
        // Mini does not have.
        expect( resolveControl(
          DAW_PORT,
          "pad.9"
        ) ).toBe( "midi.note112" );
        expect( resolveControl(
          DAW_PORT,
          "pad.16"
        ) ).toBe( "midi.note119" );
        expect( resolveControl(
          DAW_PORT,
          "pad.17"
        ) ).toBeNull();
      }
    );

    it(
      "returns null for an unknown port, an unknown control, or a bad argument",
      () => {
        expect( resolveControl(
          "Some Other Controller",
          "knob.1"
        ) ).toBeNull();
        expect( resolveControl(
          DAW_PORT,
          "knob.9"
        ) ).toBeNull();
        expect( resolveControl(
          DAW_PORT,
          "axis.left-x"
        ) ).toBeNull();
        expect( resolveControl(
          DAW_PORT,
          undefined
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "controlForChannel",
  () => {
    it(
      "walks back from a channel to the abstract control, per port",
      () => {
        // What lets a LEARNED binding be stored portably: the same knob is cc80 on
        // one port and cc23 on the other, and only "knob.3" is true on both.
        expect( controlForChannel(
          MIDI_PORT,
          "midi.cc80"
        ) ).toBe( "knob.3" );
        expect( controlForChannel(
          DAW_PORT,
          "midi.cc23"
        ) ).toBe( "knob.3" );
      }
    );

    it(
      "round-trips with resolveControl",
      () => {
        for ( let i = 1; i <= 8; i++ ) {
          const control = `knob.${ i }`;

          expect( controlForChannel(
            MIDI_PORT,
            resolveControl(
              MIDI_PORT,
              control
            )
          ) ).toBe( control );
        }
      }
    );

    it(
      "returns null when the channel is not on that port",
      () => {
        // cc80 is a MIDI-port number; the DAW port knows nothing about it.
        expect( controlForChannel(
          DAW_PORT,
          "midi.cc80"
        ) ).toBeNull();
        expect( controlForChannel(
          "Some Other Controller",
          "midi.cc80"
        ) ).toBeNull();
        expect( controlForChannel(
          MIDI_PORT,
          "audio.bass"
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "padSequence",
  () => {
    it(
      "hands back consecutive pads from the named one, in reading order",
      () => {
        expect( padSequence(
          DAW_PORT,
          "pad.1",
          3
        ) ).toEqual( [
          "midi.note96",
          "midi.note97",
          "midi.note98"
        ] );
        // The bottom row follows the top one without a gap in pad numbering.
        expect( padSequence(
          DAW_PORT,
          "pad.7",
          4
        ) ).toEqual( [
          "midi.note102",
          "midi.note103",
          "midi.note112",
          "midi.note113"
        ] );
      }
    );

    it(
      "reads a bare \"pad\" as the first pad",
      () => {
        expect( padSequence(
          MIDI_PORT,
          "pad",
          2
        ) ).toEqual( padSequence(
          MIDI_PORT,
          "pad.1",
          2
        ) );
      }
    );

    it(
      "truncates at the last pad instead of wrapping",
      () => {
        expect( padSequence(
          DAW_PORT,
          "pad.15",
          4
        ) ).toEqual( [
          "midi.note118",
          "midi.note119"
        ] );
      }
    );

    it(
      "returns null for an unknown port, a non-pad control or a bad count",
      () => {
        expect( padSequence(
          "Some Other Controller",
          "pad.1",
          8
        ) ).toBeNull();
        expect( padSequence(
          DAW_PORT,
          "knob.1",
          8
        ) ).toBeNull();
        expect( padSequence(
          DAW_PORT,
          "pad.1",
          0
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "padNoteFor",
  () => {
    it(
      "gives the note a pad answers to, which is also the note that lights it",
      () => {
        expect( padNoteFor(
          DAW_PORT,
          "pad.1"
        ) ).toBe( 96 );
        expect( padNoteFor(
          DAW_PORT,
          "pad.16"
        ) ).toBe( 119 );
        expect( padNoteFor(
          MIDI_PORT,
          "pad"
        ) ).toBe( 40 );
      }
    );

    it(
      "returns null off the grid, for a knob, or on an unknown port",
      () => {
        expect( padNoteFor(
          DAW_PORT,
          "pad.17"
        ) ).toBeNull();
        expect( padNoteFor(
          DAW_PORT,
          "knob.1"
        ) ).toBeNull();
        expect( padNoteFor(
          "Some Other Controller",
          "pad.1"
        ) ).toBeNull();
      }
    );
  }
);

describe(
  "portRequiresArming",
  () => {
    it(
      "flags the DAW port, which stays silent until it is armed",
      () => {
        expect( portRequiresArming( DAW_PORT ) ).toBe( true );
        expect( portRequiresArming( MIDI_PORT ) ).toBe( false );
        expect( portRequiresArming( "Some Other Controller" ) ).toBe( false );
      }
    );
  }
);

describe(
  "the measured pad notes",
  () => {
    it(
      "records that the DAW rows are not contiguous",
      () => {
        // 104 is a round pad the Mini MK3 does not have, so the second row starts
        // at 112 — the trap that made a hand-incremented note address nothing.
        const pads = CONTROLLER_MAPS[ DAW_PORT ].padNotes;

        expect( pads.slice(
          0,
          8
        ) ).toEqual( [
          96,
          97,
          98,
          99,
          100,
          101,
          102,
          103
        ] );
        expect( pads[ 8 ] ).toBe( 112 );
      }
    );
  }
);
