/**
 * @jest-environment jsdom
 *
 * Regression tests for GLOBAL (non-slide) animation duration.
 *
 * Per-slide duration propagation has its own suite (effectiveSlideDuration),
 * but the plain "Duration (s)" control in general settings — the one most
 * sketches use — had no coverage. These tests drive the real option-sync layer
 * (setSketchOptions -> options.js handleOptionsChange) and assert that:
 *
 *   1. Editing the global duration reaches the running sketch's clock snapshot
 *      (sketch.sketchOptions.animation.duration), and
 *   2. The time.js progression clock then loops over the NEW duration.
 */

export {};

// jest-environment-jsdom doesn't expose Node's structuredClone; the option-sync
// layer relies on it being a browser global.
if ( typeof globalThis.structuredClone !== "function" ) {
  globalThis.structuredClone = ( value: unknown ) =>
    JSON.parse( JSON.stringify( value ) );
}

/* eslint-disable @typescript-eslint/no-require-imports */
const events = require( "@/p5/utils/events.js" ).default;
const sketch = require( "@/p5/utils/sketch.js" ).default;
const time = require( "@/p5/utils/time.js" ).default;
const {
  registerEvents: registerOptionsEvents
} = require( "@/p5/utils/options.js" );
const {
  setSketchOptions, getSketchOptions
} = require( "@/p5/shared/syncSketchOptions.js" );
/* eslint-enable @typescript-eslint/no-require-imports */

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

function freshOptions( overrides: Record<string, unknown> = {} ) {
  return {
    size: {
      width: 1080,
      height: 1350
    },
    animation: {
      framerate: 60,
      duration: 12
    },
    slides: [],
    ...overrides
  };
}

describe(
  "global animation duration",
  () => {
    beforeEach( () => {
      events.registeredEvents = {};
      sketch.sketchOptions = {
        size: {
          width: 1080,
          height: 1350
        },
        animation: {
          framerate: 60,
          duration: 12
        }
      };
      time.reset();
      window.disableRecordingMode!();
    } );

    test(
      "editing the global duration reaches the running sketch clock",
      () => {
        resetStore( freshOptions() );
        registerOptionsEvents();
        events.handle( "pre-setup" );

        const next = JSON.parse( JSON.stringify( getSketchOptions() ) );

        next.animation.duration = 5;
        setSketchOptions(
          next,
          "react"
        );

        expect( sketch.sketchOptions.animation.duration ).toBe( 5 );
      }
    );

    test(
      "the progression clock loops over the new duration",
      () => {
        resetStore( freshOptions() );
        registerOptionsEvents();
        events.handle( "pre-setup" );

        const next = JSON.parse( JSON.stringify( getSketchOptions() ) );

        next.animation.duration = 5;
        setSketchOptions(
          next,
          "react"
        );

        // 2.5s into a 5s loop is exactly halfway.
        time.elapsed = 2500;
        expect( window.getAnimationProgression!() ).toBeCloseTo(
          0.5,
          6
        );

        // 6s wraps past the 5s loop back to 1s -> 20%.
        time.elapsed = 6000;
        expect( window.getAnimationProgression!() ).toBeCloseTo(
          0.2,
          6
        );
      }
    );

    test(
      "shortening then lengthening the duration both take effect",
      () => {
        resetStore( freshOptions() );
        registerOptionsEvents();
        events.handle( "pre-setup" );

        const shorten = JSON.parse( JSON.stringify( getSketchOptions() ) );

        shorten.animation.duration = 3;
        setSketchOptions(
          shorten,
          "react"
        );
        expect( sketch.sketchOptions.animation.duration ).toBe( 3 );

        const lengthen = JSON.parse( JSON.stringify( getSketchOptions() ) );

        lengthen.animation.duration = 20;
        setSketchOptions(
          lengthen,
          "react"
        );
        expect( sketch.sketchOptions.animation.duration ).toBe( 20 );
      }
    );
  }
);
