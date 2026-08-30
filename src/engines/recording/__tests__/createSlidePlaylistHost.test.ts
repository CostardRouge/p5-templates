/**
 * The slide-playlist host is what turns several slides into ONE continuous
 * clip. Two invariants matter and neither is visible from the `RecorderHost`
 * contract, so they are pinned here:
 *
 *   1. Frame indices are global to the recorder but LOCAL to the engine. The
 *      deterministic clock renders frame n at t = n / frameRate and does not
 *      wrap during capture, so handing a global index to the second slide
 *      would draw it past the end of its own loop.
 *   2. A slide switch happens once, at the boundary — not per frame.
 */

import {
  createSlidePlaylistHost
} from "../createSlidePlaylistHost";
import type {
  SketchEngine
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";

type Call = string;

function makeEngine(
  framesPerSlide: Record<number, number>,
  calls: Call[]
): SketchEngine {
  return {
    engineId: "fake",
    isReady: true,
    getTotalFrames: (
      _options: SketchOption, slideIndex?: number
    ) => framesPerSlide[ slideIndex ?? 0 ],
    getFrameRate: () => 60,
    seekAndDraw: async( frame: number ) => {
      calls.push( `seek:${ frame }` );
    },
    resetToStart: async() => {
      calls.push( "reset" );
    },
    pause: () => calls.push( "pause" ),
    play: () => calls.push( "play" ),
    beginDeterministicCapture: () => calls.push( "begin" ),
    endDeterministicCapture: () => calls.push( "end" ),
    getCanvas: () => null,
    getCaptureSource: () => ( {
      width: 100,
      height: 100,
      getStreamCanvas: () => null,
      readFrame: async() => ( {} as unknown as CanvasImageSource ),
      beginRealtime: () => undefined,
      endRealtime: () => undefined
    } )
  } as unknown as SketchEngine;
}

const OPTIONS = {} as SketchOption;

describe(
  "createSlidePlaylistHost",
  () => {
    it(
      "sums the slides' frame counts into one range",
      () => {
        const host = createSlidePlaylistHost( {
          engine: makeEngine(
            {
              0: 10,
              1: 5,
              2: 7
            },
            []
          ),
          options: OPTIONS,
          slideIndices: [
            0,
            1,
            2
          ],
          frameRate: 30,
          selectSlide: async() => undefined
        } );

        expect( host.totalFrames ).toBe( 22 );
        expect( host.frameRate ).toBe( 30 );
      }
    );

    it(
      "maps global frame indices onto each slide's local frames",
      async() => {
        const calls: Call[] = [];
        const switched: number[] = [];

        const host = createSlidePlaylistHost( {
          engine: makeEngine(
            {
              0: 3,
              1: 2
            },
            calls
          ),
          options: OPTIONS,
          slideIndices: [
            0,
            1
          ],
          frameRate: 30,
          selectSlide: async( slideIndex ) => {
            switched.push( slideIndex );
          }
        } );

        for ( let frame = 0; frame < host.totalFrames; frame++ ) {
          await host.seekAndDraw( frame );
        }

        // Slide 0 gets 0,1,2 — then slide 1 restarts at its OWN frame 0,
        // rather than continuing to 3,4.
        expect( calls ).toEqual( [
          "seek:0",
          "seek:1",
          "seek:2",
          "seek:0",
          "seek:1"
        ] );

        // And the boundary is crossed exactly once.
        expect( switched ).toEqual( [
          0,
          1
        ] );
      }
    );

    it(
      "clamps an out-of-range frame to the last slide's last frame",
      async() => {
        const calls: Call[] = [];

        const host = createSlidePlaylistHost( {
          engine: makeEngine(
            {
              0: 2,
              1: 2
            },
            calls
          ),
          options: OPTIONS,
          slideIndices: [
            0,
            1
          ],
          frameRate: 30,
          selectSlide: async() => undefined
        } );

        await host.seekAndDraw( 99 );

        expect( calls ).toEqual( [
          "seek:1"
        ] );
      }
    );

    it(
      "returns to the first slide on reset",
      async() => {
        const calls: Call[] = [];
        const switched: number[] = [];

        const host = createSlidePlaylistHost( {
          engine: makeEngine(
            {
              2: 4,
              5: 4
            },
            calls
          ),
          options: OPTIONS,
          slideIndices: [
            2,
            5
          ],
          frameRate: 30,
          selectSlide: async( slideIndex ) => {
            switched.push( slideIndex );
          }
        } );

        await host.seekAndDraw( 5 );
        await host.resetToStart();

        expect( switched ).toEqual( [
          5,
          2
        ] );
        expect( calls ).toContain( "reset" );
      }
    );

    it(
      "refuses an empty playlist rather than producing a zero-frame clip",
      () => {
        expect( () => createSlidePlaylistHost( {
          engine: makeEngine(
            {},
            []
          ),
          options: OPTIONS,
          slideIndices: [],
          frameRate: 30,
          selectSlide: async() => undefined
        } ) ).toThrow( /at least one slide/ );
      }
    );
  }
);
