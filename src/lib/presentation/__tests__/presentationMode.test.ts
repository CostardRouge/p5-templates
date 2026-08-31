/**
 * @jest-environment jsdom
 */

import {
  getSketchOptions,
  setSketchOptions
} from "@/lib/syncSketchOptions";
import {
  applyPresentationPreset,
  exitPresentation,
  getPresentationSizeSnapshot,
  getPresentationState,
  registerPresentationSurface,
  setPresentationAxis,
  togglePresentationAxis
} from "@/lib/presentation/presentationMode";

// jsdom ships no Fullscreen API, so stub the pieces the controller touches: a
// settable `fullscreenElement`, plus request/exit that flip it and fire
// `fullscreenchange` synchronously (as real browsers do).
let fakeFullscreenElement: Element | null = null;

// jsdom lays nothing out, so clientWidth/clientHeight are 0 — the observed
// surface reports whatever this holds instead.
let surfaceSize = {
  width: 1440,
  height: 900
};

let resizeCallbacks: ( () => void )[] = [];

function installStubs() {
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

  class FakeResizeObserver {
    private readonly callback: () => void;

    constructor( callback: () => void ) {
      this.callback = callback;
    }

    observe() {
      resizeCallbacks.push( this.callback );
    }

    disconnect() {
      resizeCallbacks = resizeCallbacks.filter( ( cb ) => cb !== this.callback );
    }

    unobserve() {
      this.disconnect();
    }
  }

  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
}

/** An element whose measured box is `surfaceSize`, since jsdom has no layout. */
function makeSurface(): HTMLElement {
  const element = document.createElement( "div" );

  for ( const dimension of [
    "clientWidth",
    "clientHeight"
  ] as const ) {
    Object.defineProperty(
      element,
      dimension,
      {
        configurable: true,
        get: () => ( dimension === "clientWidth" ? surfaceSize.width : surfaceSize.height )
      }
    );
  }

  return element;
}

function seedOptions( options: Record<string, unknown> ) {
  setSketchOptions(
    options,
    "test"
  );
}

function currentSize() {
  return getSketchOptions().size as { width: number;
    height: number };
}

function currentSlides() {
  return getSketchOptions().slides as { size?: { width: number;
    height: number } }[];
}

/** Fire the observed resize and run the controller's debounce out. */
function flushResize() {
  for ( const cb of [
    ...resizeCallbacks
  ] ) {
    cb();
  }

  jest.runOnlyPendingTimers();
}

beforeAll( installStubs );

beforeEach( () => {
  jest.useFakeTimers();
  exitPresentation();
  jest.runOnlyPendingTimers();

  fakeFullscreenElement = null;
  resizeCallbacks = [];
  surfaceSize = {
    width: 1440,
    height: 900
  };
  registerPresentationSurface( null );
  seedOptions( {
    size: {
      width: 1080,
      height: 1350
    },
    slides: []
  } );
} );

afterEach( () => {
  jest.useRealTimers();
} );

describe(
  "presentationMode",
  () => {
    describe(
      "the three axes are independent",
      () => {
        it(
          "hides the interface without touching fullscreen or the canvas size",
          () => {
            registerPresentationSurface( makeSurface() );
            setPresentationAxis(
              "hideInterface",
              true
            );

            expect( getPresentationState() ).toEqual( {
              fullscreen: false,
              hideInterface: true,
              stretchCanvas: false
            } );
            expect( document.fullscreenElement ).toBeNull();
            expect( currentSize() ).toEqual( {
              width: 1080,
              height: 1350
            } );
          }
        );

        it(
          "goes fullscreen while keeping the interface — the mode that was impossible before",
          () => {
            applyPresentationPreset( "focus" );

            expect( getPresentationState() ).toEqual( {
              fullscreen: true,
              hideInterface: false,
              stretchCanvas: false
            } );
            // The document root is the target, not the viewport: that is what
            // lets the studio panels survive.
            expect( document.fullscreenElement ).toBe( document.documentElement );
          }
        );

        it(
          "stretches the canvas without the Fullscreen API",
          () => {
            registerPresentationSurface( makeSurface() );
            applyPresentationPreset( "fillPage" );

            expect( document.fullscreenElement ).toBeNull();
            expect( currentSize() ).toEqual( {
              width: 1440,
              height: 900
            } );
          }
        );

        it(
          "leaving fullscreen externally (Esc) clears only that axis",
          () => {
            registerPresentationSurface( makeSurface() );
            applyPresentationPreset( "present" );

            expect( getPresentationState().fullscreen ).toBe( true );

            // What the browser does on Esc.
            fakeFullscreenElement = null;
            document.dispatchEvent( new Event( "fullscreenchange" ) );

            expect( getPresentationState() ).toEqual( {
              fullscreen: false,
              hideInterface: true,
              stretchCanvas: true
            } );
          }
        );
      }
    );

    describe(
      "stretching the canvas",
      () => {
        it(
          "rewrites every slide's size too, or the slide's own would mask it",
          () => {
            seedOptions( {
              size: {
                width: 1080,
                height: 1350
              },
              slides: [
                {
                  size: {
                    width: 1080,
                    height: 1350
                  }
                },
                {
                  size: {
                    width: 900,
                    height: 900
                  }
                }
              ]
            } );
            registerPresentationSurface( makeSurface() );
            setPresentationAxis(
              "stretchCanvas",
              true
            );

            expect( currentSize() ).toEqual( {
              width: 1440,
              height: 900
            } );
            expect( currentSlides().map( ( slide ) => slide.size ) ).toEqual( [
              {
                width: 1440,
                height: 900
              },
              {
                width: 1440,
                height: 900
              }
            ] );
          }
        );

        it(
          "restores the snapshot — root and slides — when it turns off",
          () => {
            const slides = [
              {
                size: {
                  width: 1080,
                  height: 1350
                }
              },
              {
                size: {
                  width: 900,
                  height: 900
                }
              }
            ];

            seedOptions( {
              size: {
                width: 1080,
                height: 1350
              },
              slides
            } );
            registerPresentationSurface( makeSurface() );

            setPresentationAxis(
              "stretchCanvas",
              true
            );
            setPresentationAxis(
              "stretchCanvas",
              false
            );

            expect( currentSize() ).toEqual( {
              width: 1080,
              height: 1350
            } );
            expect( currentSlides().map( ( slide ) => slide.size ) ).toEqual( [
              {
                width: 1080,
                height: 1350
              },
              {
                width: 900,
                height: 900
              }
            ] );
          }
        );

        it(
          "follows the surface as it resizes",
          () => {
            registerPresentationSurface( makeSurface() );
            setPresentationAxis(
              "stretchCanvas",
              true
            );

            surfaceSize = {
              width: 2560,
              height: 1440
            };
            flushResize();

            expect( currentSize() ).toEqual( {
              width: 2560,
              height: 1440
            } );
          }
        );

        it(
          "writes nothing when a resize tick measures the same box",
          () => {
            registerPresentationSurface( makeSurface() );
            setPresentationAxis(
              "stretchCanvas",
              true
            );

            // Every write changes `resolutionKey`, which re-lays out the
            // viewport and restarts the sketch — a no-op tick must stay silent.
            const before = currentSize();

            flushResize();

            expect( currentSize() ).toBe( before );
          }
        );

        it(
          "ignores a surface that measures zero rather than blanking the canvas",
          () => {
            surfaceSize = {
              width: 0,
              height: 0
            };
            registerPresentationSurface( makeSurface() );
            setPresentationAxis(
              "stretchCanvas",
              true
            );

            expect( currentSize() ).toEqual( {
              width: 1080,
              height: 1350
            } );
          }
        );

        it(
          "restores the size when the surface unmounts, so navigating away leaves nothing stretched",
          () => {
            registerPresentationSurface( makeSurface() );
            setPresentationAxis(
              "stretchCanvas",
              true
            );

            expect( currentSize() ).toEqual( {
              width: 1440,
              height: 900
            } );

            registerPresentationSurface( null );

            expect( getPresentationState().stretchCanvas ).toBe( false );
            expect( currentSize() ).toEqual( {
              width: 1080,
              height: 1350
            } );
          }
        );

        it(
          "exposes the pre-stretch size so an export still follows the sketch, not the screen",
          () => {
            registerPresentationSurface( makeSurface() );

            expect( getPresentationSizeSnapshot() ).toBeNull();

            setPresentationAxis(
              "stretchCanvas",
              true
            );

            expect( getPresentationSizeSnapshot()?.size ).toEqual( {
              width: 1080,
              height: 1350
            } );

            setPresentationAxis(
              "stretchCanvas",
              false
            );

            expect( getPresentationSizeSnapshot() ).toBeNull();
          }
        );
      }
    );

    describe(
      "presets and toggles",
      () => {
        it(
          "Present turns all three axes on",
          () => {
            registerPresentationSurface( makeSurface() );
            applyPresentationPreset( "present" );

            expect( getPresentationState() ).toEqual( {
              fullscreen: true,
              hideInterface: true,
              stretchCanvas: true
            } );
          }
        );

        it(
          "Present (sketch ratio) keeps the sketch's own resolution",
          () => {
            registerPresentationSurface( makeSurface() );
            applyPresentationPreset( "presentSketchRatio" );

            expect( getPresentationState().stretchCanvas ).toBe( false );
            expect( currentSize() ).toEqual( {
              width: 1080,
              height: 1350
            } );
          }
        );

        it(
          "toggling an axis flips only it",
          () => {
            registerPresentationSurface( makeSurface() );
            applyPresentationPreset( "present" );
            togglePresentationAxis( "stretchCanvas" );

            expect( getPresentationState() ).toEqual( {
              fullscreen: true,
              hideInterface: true,
              stretchCanvas: false
            } );
          }
        );

        it(
          "exitPresentation leaves fullscreen and restores the size",
          () => {
            registerPresentationSurface( makeSurface() );
            applyPresentationPreset( "present" );
            exitPresentation();

            expect( getPresentationState() ).toEqual( {
              fullscreen: false,
              hideInterface: false,
              stretchCanvas: false
            } );
            expect( document.fullscreenElement ).toBeNull();
            expect( currentSize() ).toEqual( {
              width: 1080,
              height: 1350
            } );
          }
        );
      }
    );
  }
);
