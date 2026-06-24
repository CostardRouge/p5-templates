/**
 * @jest-environment jsdom
 *
 * Regression tests for "setting the template duration has no effect" on the p5
 * recording path (front browser capture + back headless capture share this
 * clock).
 *
 * What these guard:
 *  1. A runtime duration change reaches BOTH the frame count the recorder steps
 *     through (getEffectiveSlideSettings → totalFramesFor) AND the in-page
 *     clock (sketch.sketchOptions → time.getAnimationProgression), and the two
 *     agree across the whole loop (frame f → progression f/totalFrames).
 *  2. A falsy/zero duration no longer makes the encode loop and the clock pick
 *     DIFFERENT defaults (the old `||5` vs `||10` split): both resolve to the
 *     one shared default, so the last captured frame still lands just under a
 *     full loop.
 */

export {};

if ( typeof globalThis.structuredClone !== "function" ) {
  globalThis.structuredClone = ( value: unknown ) =>
    JSON.parse( JSON.stringify( value ) );
}

/* eslint-disable @typescript-eslint/no-require-imports */
const events = require( "@/p5/utils/events.js" ).default;
const sketch = require( "@/p5/utils/sketch.js" ).default;
const time = require( "@/p5/utils/time.js" ).default;
const slides = require( "@/p5/utils/slides/index.js" ).default;
const {
  registerEvents: registerOptionsEvents
} = require( "@/p5/utils/options.js" );
const {
  setSketchOptions, getSketchOptions
} = require( "@/p5/shared/syncSketchOptions.js" );
const {
  getEffectiveSlideSettings
} = require( "@/lib/effectiveSlideSettings" );
const {
  totalFramesFor, DURATION_DEFAULT
} = require( "@/lib/animationConfig" );
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

function bootWith( animation: Record<string, unknown> ) {
  events.registeredEvents = {};
  slides.index = 0;
  window.disableRecordingMode!();
  time.reset();
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
  resetStore( {
    size: {
      width: 1080,
      height: 1350
    },
    animation: {
      framerate: 60,
      duration: 12
    },
    slides: []
  } );
  registerOptionsEvents();
  events.handle( "pre-setup" );

  const next = JSON.parse( JSON.stringify( getSketchOptions() ) );

  next.animation = animation;
  setSketchOptions(
    next,
    "react"
  );
}

describe(
  "p5 recording: duration change reaches both the frame count and the clock",
  () => {
    test(
      "duration 12→4 @30fps: every frame maps to f / totalFrames",
      () => {
        bootWith( {
          duration: 4,
          framerate: 30
        } );

        // (a) The frame count the recorder steps through.
        const totalFrames = totalFramesFor( getEffectiveSlideSettings(
          getSketchOptions(),
          undefined
        ).animation );

        expect( totalFrames ).toBe( 120 );

        // (b) The clock reads the changed duration/framerate.
        expect( sketch.sketchOptions.animation.duration ).toBe( 4 );
        expect( sketch.sketchOptions.animation.framerate ).toBe( 30 );

        // Deterministic capture: step the pinned frame index and confirm the
        // clock's progression matches f / totalFrames for the whole loop.
        window.enableRecordingMode!();

        for ( let frame = 0; frame < totalFrames; frame++ ) {
          window.setRecordingFrame!( frame );
          time.incrementElapsedTime();
          expect( window.getAnimationProgression!() ).toBeCloseTo(
            frame / totalFrames,
            6
          );
        }
      }
    );

    test(
      "duration-only change 12→4 (framerate untouched at 60) → 240 frames, last frame < 1 loop",
      () => {
        bootWith( {
          duration: 4,
          framerate: 60
        } );

        const totalFrames = totalFramesFor( getEffectiveSlideSettings(
          getSketchOptions(),
          undefined
        ).animation );

        expect( totalFrames ).toBe( 240 );
        expect( sketch.sketchOptions.animation.duration ).toBe( 4 );

        window.enableRecordingMode!();
        const lastFrame = totalFrames - 1;

        window.setRecordingFrame!( lastFrame );
        time.incrementElapsedTime();

        const progression = window.getAnimationProgression!();

        expect( progression ).toBeCloseTo(
          lastFrame / totalFrames,
          6
        );
        expect( progression ).toBeLessThan( 1 );
        expect( progression ).toBeGreaterThan( 0.99 );
      }
    );

    test(
      "REGRESSION: a falsy (0) duration no longer splits the encode default from the clock default",
      () => {
        // Old bug: recordSketch used `duration || 5` (→150 frames) while the
        // clock used `duration || 10` (→loop of 10s), so the last captured
        // frame landed at ~0.497 of the loop. Both now use the shared default.
        bootWith( {
          duration: 0,
          framerate: 30
        } );

        const totalFrames = totalFramesFor( getEffectiveSlideSettings(
          getSketchOptions(),
          undefined
        ).animation );

        // Encode loop count uses the shared default, not the old 5.
        expect( totalFrames ).toBe( DURATION_DEFAULT * 30 );
        expect( totalFrames ).not.toBe( 150 );

        window.enableRecordingMode!();
        const lastFrame = totalFrames - 1;

        window.setRecordingFrame!( lastFrame );
        time.incrementElapsedTime();

        const progression = window.getAnimationProgression!();

        // The clock denominator equals the same default → clean loop seam.
        expect( progression ).toBeCloseTo(
          lastFrame / totalFrames,
          6
        );
        expect( progression ).toBeLessThan( 1 );
        expect( progression ).toBeGreaterThan( 0.99 );
      }
    );
  }
);
