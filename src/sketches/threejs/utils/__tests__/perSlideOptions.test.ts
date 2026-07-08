/**
 * @jest-environment jsdom
 *
 * Regression test for the bug where a Three.js sketch's parameters froze the
 * moment a slide was created: the editor writes a parameter edit to the active
 * slide's override (`slides[i].sketch`), but the Three.js options accessor used
 * to read the global `sketch` block directly and had no slide awareness.
 *
 * Exercises the real wiring: runtime.setSlide() → activeSlideIndex →
 * options.sketch (proxy) → shared resolveEffectiveSketch.
 */
import sketchRuntime, {
  getActiveSlideIndex
} from "@/threejs/utils/sketch.js";
import optionsProxy from "@/threejs/utils/options.js";
import {
  getSketchOptions
} from "@/p5/shared/syncSketchOptions.js";

// The default export is a `Proxy<{}>` (typed empty); a sketch reads it as a
// loose options bag, so mirror that here for the assertions.
const options = optionsProxy as unknown as Record<string, any>;

// Replace the shared store contents in place (both modules hold the same
// `globalThis.sketchOptions` reference, so mutating it is what they observe).
function setStore( next: Record<string, any> ): void {
  const store = getSketchOptions();

  for ( const key of Object.keys( store ) ) {
    delete store[ key ];
  }

  Object.assign(
    store,
    next
  );
}

describe(
  "Three.js per-slide options",
  () => {
    beforeEach( () => {
      // reset() clears activeSlideIndex back to null (safe without a renderer).
      sketchRuntime.reset();
    } );

    it(
      "reads the global sketch block when the deck has no slides",
      () => {
        setStore( {
          sketch: {
            roughness: 0.25,
            metalness: 0.4
          },
          slides: []
        } );

        expect( getActiveSlideIndex() ).toBeNull();
        expect( options.sketch ).toEqual( {
          roughness: 0.25,
          metalness: 0.4
        } );
      }
    );

    it(
      "defaults to slide 0 when a deck has slides but setSlide hasn't run yet",
      () => {
        // Guards the init race: a saved multi-slide deck loads before the studio
        // UI wires window.setSlide, so the accessor must still resolve slide 0
        // (matching React's effective index + p5's null→0 recovery).
        setStore( {
          sketch: {
            roughness: 0.25,
            metalness: 0.4
          },
          slides: [
            {
              id: "a",
              sketch: {
                roughness: 0.9
              }
            }
          ]
        } );

        expect( getActiveSlideIndex() ).toBeNull();
        expect( options.sketch ).toEqual( {
          roughness: 0.9,
          metalness: 0.4
        } );
      }
    );

    it(
      "merges the active slide's overrides once setSlide() is called",
      () => {
        setStore( {
          sketch: {
            roughness: 0.25,
            metalness: 0.4
          },
          slides: [
            {
              id: "a",
              sketch: {
                roughness: 0.9
              }
            }
          ]
        } );

        sketchRuntime.setSlide( 0 );

        expect( getActiveSlideIndex() ).toBe( 0 );
        // roughness comes from the slide override; metalness stays global.
        expect( options.sketch ).toEqual( {
          roughness: 0.9,
          metalness: 0.4
        } );
      }
    );

    it(
      "reflects edits written to the active slide's override (the frozen-params bug)",
      () => {
        setStore( {
          sketch: {
            roughness: 0.25
          },
          slides: [
            {
              id: "a",
              sketch: {
                roughness: 0.25
              }
            }
          ]
        } );

        sketchRuntime.setSlide( 0 );

        // The user drags the roughness slider on slide 0 → editor writes the
        // active slide's override. Before the fix the accessor ignored this.
        const store = getSketchOptions();

        store.slides[ 0 ].sketch.roughness = 0.8;

        expect( options.sketch.roughness ).toBe( 0.8 );
      }
    );

    it(
      "falls back to global for a slide without its own overrides",
      () => {
        setStore( {
          sketch: {
            roughness: 0.25,
            metalness: 0.4
          },
          slides: [
            {
              id: "a",
              sketch: {
                roughness: 0.9
              }
            },
            {
              id: "b"
            }
          ]
        } );

        sketchRuntime.setSlide( 1 );

        expect( options.sketch ).toEqual( {
          roughness: 0.25,
          metalness: 0.4
        } );
      }
    );
  }
);
