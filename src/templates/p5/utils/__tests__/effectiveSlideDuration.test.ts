/**
 * @jest-environment jsdom
 *
 * Regression tests for per-slide duration propagation.
 *
 * The engine clock (animation.progression, the animation bridge,
 * window.get/setAnimationProgression) reads its duration from
 * `sketch.sketchOptions.animation` — a snapshot, not the live option
 * store. The bugs these tests guard against:
 *
 * 1. `slides.applyEffectiveSettings()` (slide switch) used to forward
 *    size/framerate to the engine but never wrote the effective animation
 *    into `sketch.sketchOptions` — AND it advanced the comparison baseline
 *    via `syncEffectivePrevious`, so the subsequent `handleOptionsChange`
 *    couldn't apply the duration either. Per-slide durations never reached
 *    the running sketch.
 *
 * 2. The post-draw bookkeeping nulls `slides.index` while the option store
 *    has no slides. Adding the first slide races that store update (React
 *    calls `setSlide(0)` before the watch→dispatch round-trip lands), so
 *    the index stayed null forever. Rendering coerces null→0, but the
 *    effective-settings resolution treated null as "no slide" and silently
 *    masked every per-slide override.
 */

// jest-environment-jsdom doesn't expose Node's structuredClone; the
// option-sync layer relies on it being a browser global.
if ( typeof globalThis.structuredClone !== "function" ) {
  globalThis.structuredClone = ( value: unknown ) =>
    JSON.parse( JSON.stringify( value ) );
}

/* eslint-disable @typescript-eslint/no-require-imports */
const events = require( "@/p5/utils/events.js" ).default;
const sketch = require( "@/p5/utils/sketch.js" ).default;
const {
  setContainer
} = require( "@/p5/utils/sketch.js" );
const slides = require( "@/p5/utils/slides/index.js" ).default;
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
  "per-slide effective duration",
  () => {
    beforeEach( () => {
      // Reset module-level state shared across tests.
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
    } );

    test(
      "applyEffectiveSettings pushes the slide's duration into sketch.sketchOptions",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1",
              animation: {
                framerate: 60,
                duration: 4
              }
            }
          ]
        } ) );

        slides.setSlide( 0 );

        expect( sketch.sketchOptions.animation.duration ).toBe( 4 );
        expect( sketch.sketchOptions.animation.framerate ).toBe( 60 );
      }
    );

    test(
      "switching between slides with different durations updates the engine clock each time",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1",
              animation: {
                framerate: 60,
                duration: 4
              }
            },
            {
              name: "Slide 2",
              animation: {
                framerate: 60,
                duration: 8
              }
            }
          ]
        } ) );

        slides.setSlide( 0 );
        expect( sketch.sketchOptions.animation.duration ).toBe( 4 );

        slides.setSlide( 1 );
        expect( sketch.sketchOptions.animation.duration ).toBe( 8 );

        slides.setSlide( 0 );
        expect( sketch.sketchOptions.animation.duration ).toBe( 4 );
      }
    );

    test(
      "slide without animation override falls back to the global animation",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1"
            }
          ]
        } ) );

        slides.setSlide( 0 );

        expect( sketch.sketchOptions.animation.duration ).toBe( 12 );
      }
    );

    test(
      "option-store changes to the slide duration apply even when slides.index is null",
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

        // Activate the options subscription the way sketch.start() does.
        registerOptionsEvents();
        events.handle( "pre-setup" );

        // Simulate the add-first-slide race aftermath: the index was nulled
        // by a post-draw that ran before the store update landed.
        slides.index = null;

        // User edits the slide duration in the form → store update.
        const next = JSON.parse( JSON.stringify( getSketchOptions() ) );

        next.slides[ 0 ].animation.duration = 3;
        setSketchOptions(
          next,
          "react"
        );

        expect( sketch.sketchOptions.animation.duration ).toBe( 3 );
      }
    );

    test(
      "post-draw recovers a nulled slides.index once slides exist in the store",
      () => {
        resetStore( freshOptions( {
          slides: [
            {
              name: "Slide 1",
              animation: {
                framerate: 60,
                duration: 5
              }
            }
          ]
        } ) );

        // post-draw needs a canvas to do its bookkeeping.
        const container = document.createElement( "div" );
        const canvas = document.createElement( "canvas" );

        canvas.className = "p5Canvas";
        container.appendChild( canvas );
        document.body.appendChild( container );
        setContainer( container );

        slides.registerEvents();
        slides.index = null;

        events.handle( "post-draw" );

        expect( slides.index ).toBe( 0 );
        expect( sketch.sketchOptions.animation.duration ).toBe( 5 );
      }
    );

    test(
      "post-draw still nulls the index when the store has no slides",
      () => {
        resetStore( freshOptions() );

        const container = document.createElement( "div" );
        const canvas = document.createElement( "canvas" );

        canvas.className = "p5Canvas";
        container.appendChild( canvas );
        document.body.appendChild( container );
        setContainer( container );

        slides.registerEvents();
        slides.index = 0;

        events.handle( "post-draw" );

        expect( slides.index ).toBeNull();
      }
    );
  }
);
