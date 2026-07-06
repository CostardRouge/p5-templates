/**
 * @jest-environment jsdom
 */

import {
  getSketchOptions,
  setSketchOptions
} from "@/lib/syncSketchOptions";
import {
  enterViewportFullscreen,
  exitViewportFullscreen,
  getFullscreenMode,
  isFullscreenSupported,
  isViewportFullscreen,
  registerFullscreenTarget
} from "@/lib/fullscreen/fullscreenViewport";

// jsdom ships no Fullscreen API, so stub the pieces the controller touches:
// a settable `fullscreenElement`, plus request/exit that flip it and fire the
// `fullscreenchange` event synchronously (as real browsers do).
let fakeFullscreenElement: Element | null = null;

const SCREEN = {
  width: 2560,
  height: 1440
};

function installFullscreenStub() {
  // jsdom (under this Node/jest combo) exposes neither structuredClone nor the
  // MessageChannel the p5 clone polyfill falls back to — mirror the guard the
  // sibling option-store tests use so `setSketchOptions` can clone.
  if ( typeof globalThis.structuredClone !== "function" ) {
    globalThis.structuredClone = ( value: unknown ) =>
      JSON.parse( JSON.stringify( value ) );
  }

  Object.defineProperty(
    document,
    "fullscreenEnabled",
    {
      configurable: true,
      get: () => true
    }
  );
  Object.defineProperty(
    document,
    "fullscreenElement",
    {
      configurable: true,
      get: () => fakeFullscreenElement
    }
  );

  Element.prototype.requestFullscreen = function requestFullscreen( this: Element ) {
    // The API delivers the target as `this`; recording it is the whole point.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    fakeFullscreenElement = this;
    document.dispatchEvent( new Event( "fullscreenchange" ) );

    return Promise.resolve();
  };

  document.exitFullscreen = function exitFullscreen() {
    fakeFullscreenElement = null;
    document.dispatchEvent( new Event( "fullscreenchange" ) );

    return Promise.resolve();
  };

  for ( const dimension of [
    "width",
    "height"
  ] as const ) {
    Object.defineProperty(
      window.screen,
      dimension,
      {
        configurable: true,
        get: () => SCREEN[ dimension ]
      }
    );
  }
}

function seedSize(
  width: number, height: number
) {
  setSketchOptions(
    {
      size: {
        width,
        height
      }
    },
    "test"
  );
}

function currentSize() {
  return getSketchOptions().size as { width: number;
    height: number };
}

beforeAll( installFullscreenStub );

beforeEach( async() => {
  // Ensure each test starts outside fullscreen with a clean target and no
  // leftover slides from a previous test.
  if ( isViewportFullscreen() ) {
    await exitViewportFullscreen();
  }

  fakeFullscreenElement = null;
  registerFullscreenTarget( null );
  setSketchOptions(
    {
      slides: []
    },
    "test"
  );
} );

describe(
  "fullscreenViewport",
  () => {
    it(
      "reports support when the browser exposes the API",
      () => {
        expect( isFullscreenSupported() ).toBe( true );
      }
    );

    it(
      "bare mode enters fullscreen and stretches the canvas to the screen resolution",
      async() => {
        const target = document.createElement( "div" );

        registerFullscreenTarget( target );
        seedSize(
          1080,
          1350
        );

        await enterViewportFullscreen( "bare" );

        expect( isViewportFullscreen() ).toBe( true );
        expect( getFullscreenMode() ).toBe( "bare" );
        expect( currentSize() ).toEqual( SCREEN );
      }
    );

    it(
      "hud mode enters fullscreen but leaves the canvas resolution untouched",
      async() => {
        const target = document.createElement( "div" );

        registerFullscreenTarget( target );
        seedSize(
          1080,
          1350
        );

        await enterViewportFullscreen( "hud" );

        expect( isViewportFullscreen() ).toBe( true );
        expect( getFullscreenMode() ).toBe( "hud" );
        expect( currentSize() ).toEqual( {
          width: 1080,
          height: 1350
        } );

        await exitViewportFullscreen();

        expect( getFullscreenMode() ).toBeNull();
        expect( currentSize() ).toEqual( {
          width: 1080,
          height: 1350
        } );
      }
    );

    it(
      "bare mode restores the previous resolution on exit",
      async() => {
        const target = document.createElement( "div" );

        registerFullscreenTarget( target );
        seedSize(
          1080,
          1350
        );

        await enterViewportFullscreen( "bare" );
        expect( currentSize() ).toEqual( SCREEN );

        await exitViewportFullscreen();

        expect( isViewportFullscreen() ).toBe( false );
        expect( currentSize() ).toEqual( {
          width: 1080,
          height: 1350
        } );
      }
    );

    it(
      "bare mode stretches every slide's size too, and restores them on exit",
      async() => {
        const target = document.createElement( "div" );

        registerFullscreenTarget( target );

        // A slide deck seeds each slide with its own size — which would mask a
        // global-only change — so bare mode must rewrite them as well.
        setSketchOptions(
          {
            size: {
              width: 1080,
              height: 1350
            },
            slides: [
              {
                name: "Slide 1",
                size: {
                  width: 1080,
                  height: 1350
                }
              },
              {
                name: "Slide 2",
                size: {
                  width: 1080,
                  height: 1350
                }
              }
            ]
          },
          "test"
        );

        await enterViewportFullscreen( "bare" );

        const inFullscreen = getSketchOptions();

        expect( inFullscreen.size ).toEqual( SCREEN );
        expect( inFullscreen.slides.map( ( slide: { size: unknown } ) => slide.size ) ).toEqual( [
          SCREEN,
          SCREEN
        ] );

        await exitViewportFullscreen();

        const restored = getSketchOptions();

        expect( restored.size ).toEqual( {
          width: 1080,
          height: 1350
        } );
        expect( restored.slides.map( ( slide: { size: unknown } ) => slide.size ) ).toEqual( [
          {
            width: 1080,
            height: 1350
          },
          {
            width: 1080,
            height: 1350
          }
        ] );
        // Non-size slide fields are left untouched.
        expect( restored.slides.map( ( slide: { name: string } ) => slide.name ) ).toEqual( [
          "Slide 1",
          "Slide 2"
        ] );
      }
    );

    it(
      "does nothing without a registered target",
      async() => {
        seedSize(
          1080,
          1350
        );

        await enterViewportFullscreen( "bare" );

        expect( isViewportFullscreen() ).toBe( false );
        expect( currentSize() ).toEqual( {
          width: 1080,
          height: 1350
        } );
      }
    );
  }
);
