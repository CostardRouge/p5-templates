/**
 * @jest-environment jsdom
 *
 * First clock/duration tests for the GSAP runtime (it previously had none — and
 * that gap is exactly where the critical "duration does nothing for GSAP" bug
 * lived).
 *
 * Guards:
 *  1. Single template: totalFrames + the progression clock follow the global
 *     animation duration, and frame f maps to progression f / totalFrames.
 *  2. Slide-aware (the bug): per-slide duration overrides reach the runtime
 *     clock (not just the recorder's frame count). Before the fix the runtime
 *     read only the GLOBAL duration, so a slide's clip played a fraction of the
 *     animation; and the runtime never exposed `setSlide`/`data-slide`, so the
 *     headless multi-slide recorder hung on `[data-slide="N"]`.
 */

import React from "react";
import {
  setSketchOptions, getSketchOptions
} from "@/lib/syncSketchOptions";
import runtime, {
  useTimeline
} from "@/gsap/utils/runtime";

// jsdom doesn't implement rAF; the runtime awaits it during start()/scrub.
beforeAll( () => {
  globalThis.requestAnimationFrame = ( ( cb: FrameRequestCallback ) =>
    setTimeout(
      () => cb( Date.now() ),
      0
    ) as unknown as number );
  globalThis.cancelAnimationFrame = ( ( id: number ) =>
    clearTimeout( id as unknown as ReturnType<typeof setTimeout> ) );
} );

const flush = () =>
  new Promise<void>( ( resolve ) =>
    requestAnimationFrame( () => requestAnimationFrame( () => resolve() ) ) );

function resetStore( opts: Record<string, unknown> ) {
  const store = getSketchOptions();

  for ( const key of Object.keys( store ) ) {
    delete store[ key ];
  }
  Object.assign(
    store,
    JSON.parse( JSON.stringify( opts ) )
  );
}

// Records the `duration` each timeline build saw, so we can prove the timeline
// is rebuilt against the slide-effective duration on a slide switch.
const builtDurations: number[] = [];

function Template( {
  options
}: {
  options: Record<string, any>;
} ) {
  useTimeline(
    ( {
      tl, options: opts
    } ) => {
      builtDurations.push( opts?.animation?.duration );
      // A loop-length tween so the timeline actually spans the duration.
      tl.to(
        {},
        {
          duration: opts?.animation?.duration ?? 1
        },
        0
      );
    },
    []
  );

  return <div className="tmpl" data-headline={ options?.sketch?.headline ?? "" } />;
}

async function mount( opts: Record<string, unknown> ) {
  resetStore( opts );

  const container = document.createElement( "div" );

  document.body.appendChild( container );

  // Avoid the SVG→Image rasterise path (jsdom can't decode it); the clock
  // logic under test doesn't need a real raster.
  ( runtime as any ).rasterize = async() => runtime.getMirrorCanvas();

  await runtime.start(
    container,
    Template
  );
  // Freeze the auto-started playback loop so progression is deterministic.
  runtime.enterRecordingMode();
  await flush();

  return container;
}

afterEach( () => {
  runtime.reset();
  document.body.innerHTML = "";
  builtDurations.length = 0;
} );

describe(
  "GSAP runtime — single template duration",
  () => {
    test(
      "totalFrames follows the global duration and frame f → f/totalFrames",
      async() => {
        await mount( {
          size: {
            width: 1080,
            height: 1350
          },
          animation: {
            duration: 4,
            framerate: 30
          },
          slides: []
        } );

        expect( runtime.duration ).toBe( 4 );
        expect( runtime.framerate ).toBe( 30 );
        expect( runtime.totalFrames ).toBe( 120 );

        const last = runtime.totalFrames - 1;

        runtime.seekFrame( last );
        expect( runtime.getProgression() ).toBeCloseTo(
          last / runtime.totalFrames,
          5
        );
        expect( runtime.getProgression() ).toBeLessThan( 1 );
      }
    );

    test(
      "a missing duration resolves to the shared default, not a runtime-local one",
      async() => {
        await mount( {
          size: {
            width: 1080,
            height: 1350
          },
          animation: {
            framerate: 30
          },
          slides: []
        } );

        // 12 (shared default) × 30 = 360 — the same default the encoder uses.
        expect( runtime.totalFrames ).toBe( 360 );
      }
    );
  }
);

describe(
  "GSAP runtime — slide-aware duration (the critical bug)",
  () => {
    const OPTS = {
      size: {
        width: 1080,
        height: 1350
      },
      animation: {
        duration: 12,
        framerate: 30
      },
      slides: [
        {
          animation: {
            duration: 4
          }
        },
        {
          animation: {
            duration: 8
          }
        }
      ]
    };

    test(
      "setSlide switches the clock duration AND the recorded frame count to the slide's value",
      async() => {
        await mount( OPTS );

        // No active slide yet → global duration.
        expect( runtime.duration ).toBe( 12 );
        expect( runtime.totalFrames ).toBe( 360 );

        runtime.setSlide( 0 );
        await flush();

        // Slide 0 overrides duration to 4 (framerate inherited = 30).
        expect( runtime.duration ).toBe( 4 );
        expect( runtime.totalFrames ).toBe( 120 );

        const last0 = runtime.totalFrames - 1;

        runtime.seekFrame( last0 );
        expect( runtime.getProgression() ).toBeCloseTo(
          last0 / runtime.totalFrames,
          5
        );

        runtime.setSlide( 1 );
        await flush();

        // Slide 1 overrides duration to 8.
        expect( runtime.duration ).toBe( 8 );
        expect( runtime.totalFrames ).toBe( 240 );
      }
    );

    test(
      "setSlide updates the stage data-slide attribute (unblocks the headless waitForSelector)",
      async() => {
        const container = await mount( OPTS );

        const stage = () =>
          container.querySelector( "[data-capture-surface=\"gsap\"]" );

        expect( stage()?.getAttribute( "data-slide" ) ).toBe( "0" );

        runtime.setSlide( 1 );
        await flush();
        expect( stage()?.getAttribute( "data-slide" ) ).toBe( "1" );

        runtime.setSlide( 0 );
        await flush();
        expect( stage()?.getAttribute( "data-slide" ) ).toBe( "0" );
      }
    );

    test(
      "the timeline is rebuilt against the slide's effective duration",
      async() => {
        await mount( OPTS );

        builtDurations.length = 0;

        runtime.setSlide( 1 );
        await flush();

        // The most recent build saw the slide-1 duration (8), not the global 12.
        expect( builtDurations[ builtDurations.length - 1 ] ).toBe( 8 );
      }
    );
  }
);
