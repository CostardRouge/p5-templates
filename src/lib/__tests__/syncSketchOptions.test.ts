/**
 * @jest-environment jsdom
 */

import {
  extractOptionsSubset,
  getSketchOptions,
  setSketchOptions,
  subscribeSketchOptions
} from "@/lib/syncSketchOptions";

// jsdom (under this Node/jest combo) exposes neither structuredClone nor the
// MessageChannel the p5 clone polyfill falls back to.
if ( typeof globalThis.structuredClone !== "function" ) {
  globalThis.structuredClone = ( value: unknown ) =>
    JSON.parse( JSON.stringify( value ) );
}

function resetStore() {
  const store = getSketchOptions();

  for ( const key of Object.keys( store ) ) {
    delete store[ key ];
  }
}

describe(
  "setSketchOptions",
  () => {
    beforeEach( resetStore );

    it(
      "deep-merges a partial update into the store",
      () => {
        setSketchOptions( {
          sketch: {
            speed: 1,
            trail: true
          }
        } );
        setSketchOptions( {
          sketch: {
            speed: 2
          }
        } );

        expect( getSketchOptions().sketch ).toEqual( {
          speed: 2,
          trail: true
        } );
      }
    );

    it(
      "keeps nested store references live across updates",
      () => {
        setSketchOptions( {
          sketch: {
            speed: 1
          }
        } );

        const sketchRef = getSketchOptions().sketch;

        setSketchOptions( {
          sketch: {
            speed: 2
          }
        } );

        expect( getSketchOptions().sketch ).toBe( sketchRef );
        expect( sketchRef.speed ).toBe( 2 );
      }
    );

    it(
      "dispatches an event only when something actually changed",
      () => {
        const seen: string[] = [];
        const unsubscribe = subscribeSketchOptions( (
          _opts, origin
        ) => {
          seen.push( origin ?? "?" );
        } );

        setSketchOptions(
          {
            sketch: {
              speed: 1,
              colors: [
                255,
                0,
                0
              ]
            }
          },
          "react"
        );

        // Deep-equal payload (fresh object and array identities) is a no-op.
        setSketchOptions(
          {
            sketch: {
              speed: 1,
              colors: [
                255,
                0,
                0
              ]
            }
          },
          "react"
        );

        setSketchOptions(
          {
            sketch: {
              speed: 3
            }
          },
          "p5"
        );

        unsubscribe();

        expect( seen ).toEqual( [
          "react",
          "p5"
        ] );
      }
    );

    it(
      "does not alias the caller's objects in the store",
      () => {
        const update = {
          sketch: {
            offsets: [
              1,
              2
            ]
          }
        };

        setSketchOptions( update );

        update.sketch.offsets.push( 3 );

        expect( getSketchOptions().sketch.offsets ).toEqual( [
          1,
          2
        ] );
      }
    );

    it(
      "treats NaN as equal to NaN so it is not a fresh change every call",
      () => {
        const seen: string[] = [];
        const unsubscribe = subscribeSketchOptions( ( _opts ) => {
          seen.push( "event" );
        } );

        setSketchOptions( {
          sketch: {
            angle: 1
          }
        } );
        // Leaf write of NaN — a real change.
        setSketchOptions( {
          sketch: {
            angle: NaN
          }
        } );
        // NaN → NaN must be a no-op, not a fresh change on every call.
        setSketchOptions( {
          sketch: {
            angle: NaN
          }
        } );

        unsubscribe();

        expect( seen ).toEqual( [
          "event",
          "event"
        ] );
      }
    );

    it(
      "replaces arrays wholesale, including when they shrink",
      () => {
        setSketchOptions( {
          slides: [
            {
              duration: 4
            },
            {
              duration: 5
            }
          ]
        } );
        setSketchOptions( {
          slides: [
            {
              duration: 4
            }
          ]
        } );

        expect( getSketchOptions().slides ).toEqual( [
          {
            duration: 4
          }
        ] );
      }
    );
  }
);

describe(
  "extractOptionsSubset",
  () => {
    const source = {
      name: "demo",
      sketch: {
        speed: 2,
        palette: {
          mode: "warm"
        }
      },
      slides: [
        {
          duration: 4
        },
        {
          duration: 6
        }
      ]
    };

    it(
      "extracts nested object paths",
      () => {
        expect( extractOptionsSubset(
          source,
          [
            "sketch.palette.mode"
          ]
        ) ).toEqual( {
          sketch: {
            palette: {
              mode: "warm"
            }
          }
        } );
      }
    );

    it(
      "stops at arrays and includes them wholesale",
      () => {
        expect( extractOptionsSubset(
          source,
          [
            "slides.0.duration"
          ]
        ) ).toEqual( {
          slides: source.slides
        } );
      }
    );

    it(
      "merges sibling paths and drops ones covered by a prefix",
      () => {
        expect( extractOptionsSubset(
          source,
          [
            "sketch.speed",
            "sketch",
            "name"
          ]
        ) ).toEqual( {
          name: "demo",
          sketch: source.sketch
        } );
      }
    );

    it(
      "stays correct when a dash-named sibling sorts between a prefix and its child",
      () => {
        // "-" < "." lexicographically, so "sketch-extra" sorts between
        // "sketch" and "sketch.speed" and breaks the last-kept-prefix chain;
        // the child walk must then be a harmless no-op on the wholesale value.
        const withDash = {
          ...source,
          "sketch-extra": true
        };

        expect( extractOptionsSubset(
          withDash,
          [
            "sketch",
            "sketch-extra",
            "sketch.speed"
          ]
        ) ).toEqual( {
          "sketch-extra": true,
          sketch: source.sketch
        } );
      }
    );

    it(
      "returns null when no path resolves",
      () => {
        expect( extractOptionsSubset(
          source,
          [
            "gone.field"
          ]
        ) ).toBeNull();
      }
    );
  }
);
