/**
 * Tests for the data-driven interaction→channel adapter and the source manifest.
 * The pure adapter lives in `channelsAdapter.js` (no heavy imports) so it can be
 * exercised without loading the interaction handler / MediaPipe.
 */
import {
  buildChannelsFromDebug,
  midiControlChannels
} from "../channelsAdapter.js";
import {
  INTERACTION_SOURCES,
  FLAT_SOURCE_IDS,
  AUDIO_BANDS,
  MIDI_CC_LAST_ID
} from "../sources.js";

// The pot bank of a Novation Launchkey Mini, as reported by the hardware:
// not contiguous, and not even in panel order (pot 6 sends a lower number than
// pot 5). It is the case that killed the original fixed `midi.cc1 … midi.cc8`
// set, so the channel adapter is tested against it rather than against a tidy
// range that would pass either way.
const LAUNCHKEY_POTS = [
  29,
  79,
  80,
  104,
  109,
  108,
  113,
  112
];

const tag = (
  source: string, x: number, y: number
) => ( {
  source,
  vector: {
    x,
    y
  }
} );

describe(
  "buildChannelsFromDebug",
  () => {
    it(
      "normalizes a canvas-space vector to 0..1 by the canvas size",
      () => {
        const channels: any = buildChannelsFromDebug(
          [
            tag(
              "mouse",
              540,
              675
            )
          ],
          1080,
          1350
        );

        expect( channels.mouse ).toEqual( {
          type: "vector2d",
          x: 0.5,
          y: 0.5
        } );
      }
    );

    it(
      "keeps the FIRST vector per source",
      () => {
        const channels: any = buildChannelsFromDebug(
          [
            tag(
              "hands",
              0,
              0
            ),
            tag(
              "hands",
              1080,
              1350
            )
          ],
          1080,
          1350
        );

        expect( channels.hands ).toEqual( {
          type: "vector2d",
          x: 0,
          y: 0
        } );
      }
    );

    it(
      "clamps out-of-canvas vectors into 0..1",
      () => {
        const channels: any = buildChannelsFromDebug(
          [
            tag(
              "gyroscope",
              -200,
              2000
            )
          ],
          1080,
          1350
        );

        expect( channels.gyroscope.x ).toBe( 0 );
        expect( channels.gyroscope.y ).toBe( 1 );
      }
    );

    it(
      "returns an empty map for empty / non-array input",
      () => {
        expect( buildChannelsFromDebug(
          [],
          1080,
          1350
        ) ).toEqual( {} );
        expect( buildChannelsFromDebug(
          undefined as any,
          1080,
          1350
        ) ).toEqual( {} );
      }
    );

    it(
      "falls back to center when the canvas has zero size",
      () => {
        const channels: any = buildChannelsFromDebug(
          [
            tag(
              "mouse",
              10,
              10
            )
          ],
          0,
          0
        );

        expect( channels.mouse ).toEqual( {
          type: "vector2d",
          x: 0.5,
          y: 0.5
        } );
      }
    );
  }
);

describe(
  "midiControlChannels",
  () => {
    it(
      "normalizes a raw 0–127 CC value to 0..1",
      () => {
        const channels: any = midiControlChannels(
          new Map( [
            [
              1,
              0
            ],
            [
              2,
              127
            ]
          ] ),
          2
        );

        expect( channels[ "midi.cc1" ] ).toEqual( {
          type: "scalar",
          value: 0
        } );
        expect( channels[ "midi.cc2" ] ).toEqual( {
          type: "scalar",
          value: 1
        } );
      }
    );

    it(
      "publishes NO channel for a CC the controller never sent",
      () => {
        const channels = midiControlChannels(
          new Map( [
            [
              3,
              64
            ]
          ] ),
          3
        );

        expect( Object.keys( channels ).sort() ).toEqual( [
          "midi.cc3",
          MIDI_CC_LAST_ID
        ] );
      }
    );

    it(
      "mints a channel for whatever CC number arrives, however scattered",
      () => {
        const controls = new Map( LAUNCHKEY_POTS.map( (
          cc, i
        ) => [
          cc,
          i * 16
        ] ) );
        const channels: any = midiControlChannels(
          controls,
          LAUNCHKEY_POTS[ 0 ]
        );

        LAUNCHKEY_POTS.forEach( (
          cc, i
        ) => {
          expect( channels[ `midi.cc${ cc }` ] ).toEqual( {
            type: "scalar",
            value: ( i * 16 ) / 127
          } );
        } );

        // No channel is invented for a number nobody sent — including the ones
        // the old fixed set declared.
        expect( channels[ "midi.cc1" ] ).toBeUndefined();
        expect( channels[ "midi.cc8" ] ).toBeUndefined();
      }
    );

    it(
      "mirrors the most recently moved CC onto the learn channel",
      () => {
        const controls = new Map( [
          [
            1,
            127
          ],
          [
            64,
            32
          ]
        ] );

        // CC 64 is outside the fixed set, so ccLast is the only way to reach it.
        expect( ( midiControlChannels(
          controls,
          64
        ) as any )[ MIDI_CC_LAST_ID ].value ).toBeCloseTo( 32 / 127 );
        expect( ( midiControlChannels(
          controls,
          1
        ) as any )[ MIDI_CC_LAST_ID ].value ).toBe( 1 );
      }
    );

    it(
      "returns an empty map with no controls, and with nothing moved yet",
      () => {
        expect( midiControlChannels(
          new Map(),
          -1
        ) ).toEqual( {} );
        expect( midiControlChannels(
          null,
          -1
        ) ).toEqual( {} );
        expect( midiControlChannels(
          undefined,
          undefined
        ) ).toEqual( {} );
      }
    );
  }
);

describe(
  "interaction source manifest",
  () => {
    it(
      "lists every flat-collector source as a vector2d channel",
      () => {
        const vectorIds = INTERACTION_SOURCES
          .filter( ( s ) => s.type === "vector2d" )
          .map( ( s ) => s.id );

        expect( vectorIds.sort() ).toEqual( [
          ...FLAT_SOURCE_IDS
        ].sort() );
      }
    );

    it(
      "matches the canonical _FLAT_COLLECTORS tag set (kept in sync with index.js)",
      () => {
        expect( [
          ...FLAT_SOURCE_IDS
        ].sort() ).toEqual( [
          "audio",
          "body",
          "face",
          "faceMesh",
          "fingers",
          "gyroscope",
          "hands",
          "joypad",
          "joypadRight",
          "midi",
          "mouse",
          "orbit",
          "perlinNoise",
          "touch"
        ] );
      }
    );

    it(
      "exposes a scalar audio.<band> channel for every audio band plus level",
      () => {
        const scalarIds = INTERACTION_SOURCES
          .filter( ( s ) => s.type === "scalar" )
          .map( ( s ) => s.id );

        for ( const band of AUDIO_BANDS ) {
          expect( scalarIds ).toContain( `audio.${ band }` );
        }
        expect( scalarIds ).toContain( "audio.level" );
      }
    );

    it(
      "declares the MIDI learn channel and NO fixed per-CC channel",
      () => {
        const scalarIds = INTERACTION_SOURCES
          .filter( ( s ) => s.type === "scalar" )
          .map( ( s ) => s.id );

        expect( scalarIds ).toContain( MIDI_CC_LAST_ID );
        // Per-control channels are minted from the hardware, so a manifest
        // entry for one would be a guess — the bug this replaced.
        expect( scalarIds.filter( ( id ) => /^midi\.cc\d+$/.test( id ) ) ).toEqual( [] );
      }
    );
  }
);
