/**
 * Unit tests for the portable hand-clip format (`shared/handClip.js`):
 * layout conventions, the tip-gap helper, and the serialize/parse round trip
 * that every recorded take rides through.
 */
import fc from "fast-check";

import {
  HAND_CLIP_FORMAT,
  HAND_CLIP_QUANT,
  handClipGap,
  handClipLayout,
  downloadHandClip,
  parseHandClip,
  serializeHandClip
} from "../handClip.js";

type Clip = {
  name: string;
  tags: string[];
  handedness: string;
  fps: number;
  frameCount: number;
  layout: string;
  aspect: number;
  quant: number;
  frames: Float32Array;
  phases: object | null;
  anchors: object | null;
  gapRange: number[] | null;
  capture: object | null;
};

const makeClip = (
  layout: string,
  frameCount: number,
  frames: Float32Array
): Clip => ( {
  name: "test-clip",
  tags: [
    "pinch"
  ],
  handedness: "Right",
  fps: 60,
  frameCount,
  layout,
  aspect: 4 / 3,
  quant: HAND_CLIP_QUANT,
  frames,
  phases: null,
  anchors: null,
  gapRange: null,
  capture: null
} );

describe(
  "handClipLayout",
  () => {
    it(
      "exposes the MediaPipe tip indices per layout",
      () => {
        expect( handClipLayout( "landmarks-21" ) ).toMatchObject( {
          pointCount: 21,
          thumbTip: 4,
          indexTip: 8
        } );
        expect( handClipLayout( "tips-6" ) ).toMatchObject( {
          pointCount: 6,
          thumbTip: 1,
          indexTip: 2
        } );
      }
    );

    it(
      "throws on an unknown layout",
      () => {
        expect( () => handClipLayout( "landmarks-33" ) ).toThrow( /unknown layout/ );
      }
    );
  }
);

describe(
  "handClipGap",
  () => {
    it(
      "measures the thumb/index tip distance of a frame",
      () => {
        const frames = new Float32Array( 6 * 2 );

        // tips-6: thumb tip at index 1, index tip at index 2.
        frames[ 1 * 2 ] = 0.3;
        frames[ 1 * 2 + 1 ] = 0.4;
        frames[ 2 * 2 ] = 0.6;
        frames[ 2 * 2 + 1 ] = 0.8;

        const clip = makeClip(
          "tips-6",
          1,
          frames
        );

        expect( handClipGap(
          clip,
          0
        ) ).toBeCloseTo(
          0.5,
          6
        );
      }
    );
  }
);

describe(
  "serializeHandClip / parseHandClip",
  () => {
    it(
      "round-trips exactly for any clip whose values sit on the quant grid",
      () => {
        // Integers in the stored range map to exactly representable
        // float32 values (i / 2^12), so the round trip must be lossless.
        const clipArb = fc
          .record( {
            layout: fc.constantFrom(
              "tips-6",
              "landmarks-21"
            ),
            frameCount: fc.integer( {
              min: 1,
              max: 5
            } )
          } )
          .chain( ( {
            layout, frameCount
          } ) => {
            const length = frameCount * handClipLayout( layout ).pointCount * 2;

            return fc
              .array(
                fc.integer( {
                  min: -819,
                  max: 4915
                } ),
                {
                  minLength: length,
                  maxLength: length
                }
              )
              .map( ( ints ) => makeClip(
                layout,
                frameCount,
                Float32Array.from(
                  ints,
                  ( value ) => value / HAND_CLIP_QUANT
                )
              ) );
          } );

        fc.assert( fc.property(
          clipArb,
          ( clip ) => {
            const parsed = parseHandClip( serializeHandClip( clip ) );

            expect( parsed.name ).toBe( clip.name );
            expect( parsed.tags ).toEqual( clip.tags );
            expect( parsed.handedness ).toBe( clip.handedness );
            expect( parsed.fps ).toBe( clip.fps );
            expect( parsed.frameCount ).toBe( clip.frameCount );
            expect( parsed.layout ).toBe( clip.layout );
            expect( parsed.aspect ).toBeCloseTo(
              clip.aspect,
              9
            );
            expect( Array.from( parsed.frames ) ).toEqual( Array.from( clip.frames ) );
          }
        ) );
      }
    );

    it(
      "stamps the format identifier and keeps metadata",
      () => {
        const clip = makeClip(
          "tips-6",
          1,
          new Float32Array( 12 )
        );

        clip.phases = {
          close: 0
        };
        clip.anchors = {
          grab: {
            x: 0.5,
            y: 0.5
          },
          release: {
            x: 0.7,
            y: 0.5
          }
        };

        const data = JSON.parse( serializeHandClip( clip ) );

        expect( data.format ).toBe( HAND_CLIP_FORMAT );
        expect( data.version ).toBe( 1 );
        expect( data.space ).toBe( "normalized" );

        const parsed = parseHandClip( data );

        expect( parsed.phases ).toEqual( clip.phases );
        expect( parsed.anchors ).toEqual( clip.anchors );
      }
    );

    it(
      "recomputes a missing gapRange on parse",
      () => {
        const frames = new Float32Array( 6 * 2 );

        frames[ 1 * 2 ] = 0.25;
        frames[ 2 * 2 ] = 0.5;

        const parsed = parseHandClip( serializeHandClip( makeClip(
          "tips-6",
          1,
          frames
        ) ) );

        expect( parsed.gapRange?.[ 0 ] ).toBeCloseTo(
          0.25,
          4
        );
        expect( parsed.gapRange?.[ 1 ] ).toBeCloseTo(
          0.25,
          4
        );
      }
    );

    it(
      "rejects payloads that are not hand clips",
      () => {
        expect( () => parseHandClip( "{}" ) ).toThrow( /not a valid hand-clip/ );
        expect( () => parseHandClip( {
          format: "p5t-wavetable",
          frames: [
            1
          ],
          fps: 60
        } ) ).toThrow( /not a valid hand-clip/ );
        expect( () => parseHandClip( {
          format: HAND_CLIP_FORMAT,
          version: 1,
          layout: "tips-6",
          fps: 60,
          frameCount: 2,
          frames: [
            1,
            2,
            3
          ]
        } ) ).toThrow( /does not match/ );
      }
    );

    it(
      "refuses to serialise a clip whose frames don't match its shape",
      () => {
        const clip = makeClip(
          "tips-6",
          2,
          new Float32Array( 12 )
        );

        expect( () => serializeHandClip( clip ) ).toThrow( /does not match/ );
      }
    );
  }
);

describe(
  "downloadHandClip",
  () => {
    it(
      "is a silent no-op outside the browser",
      () => {
        const clip = makeClip(
          "tips-6",
          1,
          new Float32Array( 12 )
        );

        expect( () => downloadHandClip(
          clip,
          "x.json"
        ) ).not.toThrow();
      }
    );
  }
);
