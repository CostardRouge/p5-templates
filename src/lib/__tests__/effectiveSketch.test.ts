import {
  resolveEffectiveSketch
} from "../effectiveSketch";

describe(
  "resolveEffectiveSketch",
  () => {
    const options = {
      sketch: {
        roughness: 0.25,
        metalness: 0.4,
        color: [
          124,
          92,
          255
        ]
      },
      slides: [
        {
          id: "a",
          sketch: {
            roughness: 0.9
          }
        },
        {
          id: "b",
          sketch: {
            metalness: 1,
            color: [
              10,
              20,
              30
            ]
          }
        },
        {
          id: "c"
        }
      ]
    };

    it(
      "returns the global sketch block when there is no active slide",
      () => {
        expect( resolveEffectiveSketch(
          options,
          undefined
        ) ).toEqual( options.sketch );
        expect( resolveEffectiveSketch(
          options,
          null
        ) ).toEqual( options.sketch );
      }
    );

    it(
      "merges the active slide's overrides over the global block",
      () => {
        // Slide 0 overrides only roughness — global metalness/color survive.
        expect( resolveEffectiveSketch(
          options,
          0
        ) ).toEqual( {
          roughness: 0.9,
          metalness: 0.4,
          color: [
            124,
            92,
            255
          ]
        } );
      }
    );

    it(
      "lets a later slide override multiple keys independently",
      () => {
        expect( resolveEffectiveSketch(
          options,
          1
        ) ).toEqual( {
          roughness: 0.25,
          metalness: 1,
          color: [
            10,
            20,
            30
          ]
        } );
      }
    );

    it(
      "falls back to the global block for a slide with no overrides",
      () => {
        expect( resolveEffectiveSketch(
          options,
          2
        ) ).toEqual( options.sketch );
      }
    );

    it(
      "wraps out-of-range and negative indices like the p5 slides module",
      () => {
        // 3 wraps to slide 0, -1 wraps to slide 2.
        expect( resolveEffectiveSketch(
          options,
          3
        ) ).toEqual( resolveEffectiveSketch(
          options,
          0
        ) );
        expect( resolveEffectiveSketch(
          options,
          -1
        ) ).toEqual( resolveEffectiveSketch(
          options,
          2
        ) );
      }
    );

    it(
      "returns an empty object when nothing is defined",
      () => {
        expect( resolveEffectiveSketch(
          {},
          0
        ) ).toEqual( {} );
        expect( resolveEffectiveSketch(
          undefined,
          undefined
        ) ).toEqual( {} );
      }
    );

    it(
      "ignores slideIndex when the deck has no slides",
      () => {
        const noSlides = {
          sketch: {
            a: 1
          }
        };

        expect( resolveEffectiveSketch(
          noSlides,
          0
        ) ).toEqual( {
          a: 1
        } );
      }
    );
  }
);
