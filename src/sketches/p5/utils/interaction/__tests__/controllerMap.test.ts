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
  controllerMapFor,
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
