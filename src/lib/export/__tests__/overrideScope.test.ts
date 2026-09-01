/**
 * @jest-environment jsdom
 */
/**
 * The override scope is what lets one variant render at 1080x1920 and the next
 * at 1080x1080 without either leaking into the user's studio. Its guarantees:
 *
 *   - the push reaches the option store,
 *   - per-slide size/animation overrides are stripped, or a global size push
 *     would be silently masked by the active slide's own,
 *   - the form's own option pushes are gated for the duration,
 *   - and the gate is ALWAYS lifted, including when the initial resize never
 *     lands.
 */

import {
  applyExportOverrides
} from "../overrideScope";
import {
  getSketchOptions,
  isReactSketchOptionsSyncSuspended,
  setSketchOptions
} from "@/lib/syncSketchOptions";
import type {
  SketchEngine
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";

function makeEngine( surface: {
  width: number;
  height: number;
} ): SketchEngine {
  return {
    getCaptureSource: () => ( {
      width: surface.width,
      height: surface.height,
      getStreamCanvas: () => null,
      readFrame: async() => ( {} as unknown as CanvasImageSource ),
      beginRealtime: () => undefined,
      endRealtime: () => undefined
    } ),
    redraw: () => undefined
  } as unknown as SketchEngine;
}

const OPTIONS = {
  size: {
    width: 1080,
    height: 1350
  },
  animation: {
    duration: 12,
    framerate: 60
  },
  slides: [
    {
      id: "a",
      size: {
        width: 1080,
        height: 1080
      },
      animation: {
        framerate: 24
      },
      content: []
    }
  ]
} as unknown as SketchOption;

describe(
  "applyExportOverrides",
  () => {
    beforeEach( () => {
      // Reset the module-level option store between tests.
      setSketchOptions(
        {
          size: {
            width: 1080,
            height: 1350
          },
          animation: {
            duration: 12,
            framerate: 60
          },
          slides: []
        },
        "react"
      );
    } );

    it(
      "pushes the target size and framerate, and strips per-slide overrides",
      async() => {
        // The surface reports the target immediately, as p5's synchronous
        // resize does.
        const engine = makeEngine( {
          width: 1080,
          height: 1920
        } );

        const handle = await applyExportOverrides(
          engine,
          OPTIONS,
          {
            size: {
              width: 1080,
              height: 1920
            },
            framerate: 30
          }
        );

        const store = getSketchOptions();

        expect( store.size ).toEqual( {
          width: 1080,
          height: 1920
        } );
        expect( store.animation.framerate ).toBe( 30 );
        // Slide 0's own 1080x1080 / 24fps would otherwise mask the push.
        expect( store.slides[ 0 ].size ).toBeUndefined();
        expect( store.slides[ 0 ].animation ).toBeUndefined();
        expect( store.slides[ 0 ].id ).toBe( "a" );

        await handle.restore();
      }
    );

    it(
      "gates the form's own pushes while active, then replays them",
      async() => {
        const engine = makeEngine( {
          width: 1080,
          height: 1920
        } );

        const handle = await applyExportOverrides(
          engine,
          OPTIONS,
          {
            size: {
              width: 1080,
              height: 1920
            },
            framerate: 30
          }
        );

        expect( isReactSketchOptionsSyncSuspended() ).toBe( true );

        // A slider drag mid-export must not resize the canvas under the
        // running encoder...
        setSketchOptions(
          {
            size: {
              width: 640,
              height: 480
            }
          },
          "react"
        );
        expect( getSketchOptions().size ).toEqual( {
          width: 1080,
          height: 1920
        } );

        await handle.restore();

        // ...but it must not be lost either.
        expect( isReactSketchOptionsSyncSuspended() ).toBe( false );
        expect( getSketchOptions().size ).toEqual( {
          width: 640,
          height: 480
        } );
      }
    );

    it(
      "restores the original size and is safe to call twice",
      async() => {
        const engine = makeEngine( {
          width: 1080,
          height: 1920
        } );

        const handle = await applyExportOverrides(
          engine,
          OPTIONS,
          {
            size: {
              width: 1080,
              height: 1920
            },
            framerate: 30
          }
        );

        await handle.restore();
        await handle.restore();

        expect( getSketchOptions().size ).toEqual( {
          width: 1080,
          height: 1350
        } );
        expect( getSketchOptions().animation.framerate ).toBe( 60 );
      }
    );

    it(
      "does not wait when the canvas is already the target size",
      async() => {
        // The most common case by far: a variant whose size matches the live
        // canvas. Settling it would cost two render frames for nothing — and
        // on a heavy sketch a frame is seconds, not milliseconds.
        let frames = 0;
        const raf = globalThis.requestAnimationFrame;

        globalThis.requestAnimationFrame = ( ( cb: FrameRequestCallback ) => {
          frames++;

          return raf( cb );
        } ) as typeof globalThis.requestAnimationFrame;

        try {
          const handle = await applyExportOverrides(
            makeEngine( {
              width: 1080,
              height: 1350
            } ),
            OPTIONS,
            {
              size: {
                width: 1080,
                height: 1350
              },
              framerate: 30
            }
          );

          // Only the single post-redraw frame, never a stability window.
          expect( frames ).toBe( 1 );

          await handle.restore();
        } finally {
          globalThis.requestAnimationFrame = raf;
        }
      }
    );

    it(
      "lifts the gate when the resize never lands, rather than deafening the studio",
      async() => {
        // A surface that never reaches the target — the timeout path.
        const engine = makeEngine( {
          width: 1080,
          height: 1350
        } );

        await expect( applyExportOverrides(
          engine,
          OPTIONS,
          {
            size: {
              width: 1080,
              height: 1920
            },
            framerate: 30
          }
        ) ).rejects.toThrow( /did not resize/ );

        expect( isReactSketchOptionsSyncSuspended() ).toBe( false );
        expect( getSketchOptions().size ).toEqual( {
          width: 1080,
          height: 1350
        } );
      },
      10_000
    );

    describe(
      "when the browser stops delivering animation frames",
      () => {
        // A backgrounded tab, a minimised window, or a software renderer with
        // nothing left to composite: `requestAnimationFrame` is accepted and
        // never called back. Every wait here sits in a loop whose deadline is
        // checked BETWEEN frames, so a frame that never comes does not make an
        // export slow — it hangs it forever on "Preparing…".
        const deadRaf = ( () => 1 ) as unknown as typeof globalThis.requestAnimationFrame;

        it(
          "still finishes a push whose size already matches",
          async() => {
            const raf = globalThis.requestAnimationFrame;

            globalThis.requestAnimationFrame = deadRaf;
            jest.useFakeTimers();

            try {
              const pending = applyExportOverrides(
                makeEngine( {
                  width: 1080,
                  height: 1350
                } ),
                OPTIONS,
                {
                  size: {
                    width: 1080,
                    height: 1350
                  },
                  framerate: 30
                }
              );

              await jest.advanceTimersByTimeAsync( 1_000 );

              const handle = await pending;

              await handle.restore();
              expect( isReactSketchOptionsSyncSuspended() ).toBe( false );
            } finally {
              jest.useRealTimers();
              globalThis.requestAnimationFrame = raf;
            }
          }
        );

        it(
          "gives up on a resize that never lands, instead of waiting forever",
          async() => {
            const raf = globalThis.requestAnimationFrame;

            globalThis.requestAnimationFrame = deadRaf;
            jest.useFakeTimers();

            try {
              const pending = applyExportOverrides(
                makeEngine( {
                  width: 1080,
                  height: 1350
                } ),
                OPTIONS,
                {
                  size: {
                    width: 1080,
                    height: 1920
                  },
                  framerate: 30
                }
              );
              const rejects = expect( pending ).rejects.toThrow( /did not resize/ );

              await jest.advanceTimersByTimeAsync( 31_000 );
              await rejects;

              expect( isReactSketchOptionsSyncSuspended() ).toBe( false );
            } finally {
              jest.useRealTimers();
              globalThis.requestAnimationFrame = raf;
            }
          }
        );
      }
    );
  }
);
