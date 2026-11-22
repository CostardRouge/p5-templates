/**
 * A layer runs on its sketch's own defaults UNDER its settings: a scene
 * written by a program (a reel) carries `settings: {}`, and a sketch that
 * reads `options.sketch.shape.stroke` threw on it — a black scene.
 */
import {
  withDefaults
} from "../layerDefaults.js";

describe(
  "a layer's settings over its sketch's defaults",
  () => {
    const defaults = {
      shape: {
        stroke: [
          0
        ],
        strokeWeight: 3.9
      },
      roughness: {
        mode: "fixed",
        value: 1.5
      },
      backgroundColor: [
        246,
        235,
        225
      ]
    };

    it(
      "gives an empty layer every default",
      () => {
        expect( withDefaults(
          defaults,
          {}
        ) ).toEqual( defaults );
        expect( withDefaults(
          defaults,
          undefined
        ) ).toBe( defaults );
      }
    );

    it(
      "lets what the layer sets win, key by key, and leaves the rest",
      () => {
        expect( withDefaults(
          defaults,
          {
            shape: {
              strokeWeight: 1
            },
            extra: true
          }
        ) ).toEqual( {
          ...defaults,
          shape: {
            stroke: [
              0
            ],
            strokeWeight: 1
          },
          extra: true
        } );
      }
    );

    it(
      "replaces a list or a value whole, never mixes it with the default",
      () => {
        const out = withDefaults(
          defaults,
          {
            backgroundColor: [
              0
            ],
            roughness: 2,
            shape: {
              stroke: null
            }
          }
        );

        expect( out.backgroundColor ).toEqual( [
          0
        ] );
        expect( out.roughness ).toBe( 2 );
        // An explicit null is a choice, not an absence.
        expect( out.shape.stroke ).toBeNull();
        expect( defaults.backgroundColor ).toHaveLength( 3 );
      }
    );
  }
);
