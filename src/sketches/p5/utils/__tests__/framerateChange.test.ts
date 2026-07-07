/**
 * @jest-environment jsdom
 *
 * Regression tests for runtime framerate changes.
 *
 * The pipeline under test: option-store update (or slide switch) →
 * options.js / slides.applyEffectiveSettings → "engine-framerate-change"
 * → sketch.js handler → p.frameRate().
 *
 * Bugs these tests guard against:
 *
 * 1. p5's `frameRate()` silently ignores non-number arguments. A framerate
 *    arriving as a numeric string (imported options.json, persisted job)
 *    passed the slides path's bare `> 0` check and was then dropped by p5
 *    with no error — the loop kept running at the old rate. Every call
 *    site now coerces through `coerceFramerate()`.
 *
 * 2. options.js gated the event behind `typeof framerate === "number"`,
 *    so the same string framerate never even fired the event — while the
 *    comparison baseline still advanced, permanently swallowing the change.
 *
 * 3. A per-slide animation override can be partial ({ framerate } only);
 *    resolving it with `??` instead of a merge dropped the global duration.
 */

// Module scope (not script scope): the sibling test files declare the same
// require'd names at top level.
export {};

if ( typeof globalThis.structuredClone !== "function" ) {
  globalThis.structuredClone = ( value: unknown ) =>
    JSON.parse( JSON.stringify( value ) );
}

/* eslint-disable @typescript-eslint/no-require-imports */
const events = require( "@/p5/utils/events.js" ).default;
const sketch = require( "@/p5/utils/sketch.js" ).default;
const {
  setContainer, setP5
} = require( "@/p5/utils/sketch.js" );
const slides = require( "@/p5/utils/slides/index.js" ).default;
const {
  registerEvents: registerOptionsEvents
} = require( "@/p5/utils/options.js" );
const {
  setSketchOptions, getSketchOptions
} = require( "@/p5/shared/syncSketchOptions.js" );
const {
  coerceFramerate
} = require( "@/p5/utils/framerate.js" );
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

// Minimal p5 stand-in mirroring p5 1.11's frameRate() argument handling:
// non-number arguments are silently ignored (the getter path).
function makeFakeP5() {
  const p: any = {
    _targetFrameRate: 60,
    frameRate( fps?: unknown ) {
      if ( typeof fps !== "number" || ( fps as number ) < 0 ) {
        return p._targetFrameRate;
      }
      p._targetFrameRate = fps;

      return p;
    }
  };

  return p;
}

describe(
  "coerceFramerate",
  () => {
    test(
      "accepts numbers and numeric strings",
      () => {
        expect( coerceFramerate( 24 ) ).toBe( 24 );
        expect( coerceFramerate( "24" ) ).toBe( 24 );
        expect( coerceFramerate( 0.5 ) ).toBe( 0.5 );
      }
    );

    test(
      "rejects unusable values",
      () => {
        expect( coerceFramerate( undefined ) ).toBeNull();
        expect( coerceFramerate( null ) ).toBeNull();
        expect( coerceFramerate( "" ) ).toBeNull();
        expect( coerceFramerate( "abc" ) ).toBeNull();
        expect( coerceFramerate( 0 ) ).toBeNull();
        expect( coerceFramerate( -30 ) ).toBeNull();
        expect( coerceFramerate( Infinity ) ).toBeNull();
        expect( coerceFramerate( NaN ) ).toBeNull();
      }
    );
  }
);

describe(
  "runtime framerate changes",
  () => {
    let p: any;

    beforeEach( () => {
      events.registeredEvents = {};
      slides.index = 0;
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

      document.body.innerHTML = "";
      setContainer( null );

      p = makeFakeP5();
      setP5( p );

      // Register engine handlers the way sketch.start() does.
      Object.entries( sketch.eventHandlers ).forEach( ( [
        name,
        handler
      ] ) => {
        events.register(
          name,
          handler as ( ...args: unknown[] ) => unknown
        );
      } );
    } );

    afterEach( () => {
      setP5( null );
    } );

    test(
      "editing the active slide's framerate in the store reaches p.frameRate",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1",
              animation: {
                framerate: 60,
                duration: 12
              }
            }
          ]
        } ) );

        registerOptionsEvents();
        events.handle( "pre-setup" );
        slides.setSlide( 0 );

        const next = JSON.parse( JSON.stringify( getSketchOptions() ) );

        next.slides[ 0 ].animation.framerate = 24;
        setSketchOptions(
          next,
          "react"
        );

        expect( p._targetFrameRate ).toBe( 24 );
      }
    );

    test(
      "a string framerate from the store still applies (options path)",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1",
              animation: {
                framerate: 60,
                duration: 12
              }
            }
          ]
        } ) );

        registerOptionsEvents();
        events.handle( "pre-setup" );
        slides.setSlide( 0 );

        const next = JSON.parse( JSON.stringify( getSketchOptions() ) );

        next.slides[ 0 ].animation.framerate = "24";
        setSketchOptions(
          next,
          "react"
        );

        expect( p._targetFrameRate ).toBe( 24 );
      }
    );

    test(
      "a string framerate still applies on slide switch (slides path)",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1",
              animation: {
                framerate: "30",
                duration: 12
              }
            }
          ]
        } ) );

        slides.setSlide( 0 );

        expect( p._targetFrameRate ).toBe( 30 );
      }
    );

    test(
      "switching slides applies each slide's framerate",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1",
              animation: {
                framerate: 60,
                duration: 12
              }
            },
            {
              name: "Slide 2",
              animation: {
                framerate: 24,
                duration: 12
              }
            }
          ]
        } ) );

        slides.setSlide( 1 );
        expect( p._targetFrameRate ).toBe( 24 );

        slides.setSlide( 0 );
        expect( p._targetFrameRate ).toBe( 60 );
      }
    );

    test(
      "an invalid framerate is ignored and keeps the current rate",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1",
              animation: {
                framerate: "abc",
                duration: 12
              }
            }
          ]
        } ) );

        slides.setSlide( 0 );

        expect( p._targetFrameRate ).toBe( 60 );
      }
    );

    test(
      "a partial slide override ({ framerate } only) keeps the global duration",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1",
              animation: {
                framerate: 24
              }
            }
          ]
        } ) );

        slides.setSlide( 0 );

        expect( p._targetFrameRate ).toBe( 24 );
        expect( sketch.sketchOptions.animation.duration ).toBe( 12 );
        expect( sketch.sketchOptions.animation.framerate ).toBe( 24 );
      }
    );

    test(
      "a partial slide override ({ duration } only) keeps the global framerate",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1",
              animation: {
                duration: 4
              }
            }
          ]
        } ) );

        slides.setSlide( 0 );

        expect( p._targetFrameRate ).toBe( 60 );
        expect( sketch.sketchOptions.animation.duration ).toBe( 4 );
        expect( sketch.sketchOptions.animation.framerate ).toBe( 60 );
      }
    );
  }
);
