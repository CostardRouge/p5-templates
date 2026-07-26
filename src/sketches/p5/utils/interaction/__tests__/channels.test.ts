/**
 * Tests for the data-driven interaction→channel adapter and the source manifest.
 * The pure adapter lives in `channelsAdapter.js` (no heavy imports) so it can be
 * exercised without loading the interaction handler / MediaPipe.
 */
import {
  buildChannelsFromDebug
} from "../channelsAdapter.js";
import {
  INTERACTION_SOURCES,
  FLAT_SOURCE_IDS,
  AUDIO_BANDS
} from "../sources.js";

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
  }
);
