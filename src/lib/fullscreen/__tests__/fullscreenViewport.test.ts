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
  // Ensure each test starts outside fullscreen with a clean target.
  if ( isViewportFullscreen() ) {
    await exitViewportFullscreen();
  }

  fakeFullscreenElement = null;
  registerFullscreenTarget( null );
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
      "enters fullscreen and switches the canvas to the screen resolution",
      async() => {
        const target = document.createElement( "div" );

        registerFullscreenTarget( target );
        seedSize(
          1080,
          1350
        );

        await enterViewportFullscreen();

        expect( isViewportFullscreen() ).toBe( true );
        expect( currentSize() ).toEqual( SCREEN );
      }
    );

    it(
      "restores the previous resolution on exit",
      async() => {
        const target = document.createElement( "div" );

        registerFullscreenTarget( target );
        seedSize(
          1080,
          1350
        );

        await enterViewportFullscreen();
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
      "does not restore when the size changed by other means while fullscreen",
      async() => {
        const target = document.createElement( "div" );

        registerFullscreenTarget( target );
        seedSize(
          1080,
          1350
        );

        await enterViewportFullscreen();

        // A sketch (or any other source) changes the size while fullscreen —
        // the exit must not clobber that with the stashed pre-fullscreen size.
        seedSize(
          1080,
          1080
        );

        await exitViewportFullscreen();

        expect( currentSize() ).toEqual( {
          width: 1080,
          height: 1080
        } );
      }
    );

    it(
      "does nothing without a registered target",
      async() => {
        seedSize(
          1080,
          1350
        );

        await enterViewportFullscreen();

        expect( isViewportFullscreen() ).toBe( false );
        expect( currentSize() ).toEqual( {
          width: 1080,
          height: 1350
        } );
      }
    );
  }
);
