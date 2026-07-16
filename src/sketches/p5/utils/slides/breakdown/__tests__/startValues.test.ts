/**
 * Covers the deterministic min/opposite/departure start-value rules:
 *   - number with form range: start at min; min ≈ final → start at max
 *   - departure scales the travel (1 = full, 0.5 = half, 0 = identity)
 *   - integer steps snap (no float-dust narration)
 *   - colors invert per RGB channel (alpha kept), scaled by departure
 *   - booleans flip at departure ≥ 0.5; strings keep final
 *   - vector2d leaves resolve per-axis ranges from the parent pad
 *   - no form range → heuristic toward 0 (or 1 when final is 0)
 *   - snap/exclude keys keep their final values
 */

import buildStartValues from "../startValues.js";

const sketch = {
  seed: 42,
  animated: true,
  mode: "smooth",
  strokeColor: [
    200,
    50,
    50,
    255
  ],
  grid: {
    columns: 8,
    position: {
      x: 0.5,
      y: 0.25
    }
  }
};

const formMeta = {
  formConfiguration: {
    strokeColor: {
      component: "color"
    },
    grid: {
      component: "nested-object",
      fields: {
        columns: {
          component: "slider",
          min: 2,
          max: 20,
          step: 1
        },
        position: {
          component: "vector2d",
          allowNegative: false,
          min: 0,
          max: 1,
          step: 0.01
        }
      }
    }
  }
};

const build = ( overrides = {} ) => ( {
  departure: 1,
  snapKeys: [
    "seed"
  ],
  excludeKeys: [
    "animated"
  ],
  ...overrides
} );

describe(
  "buildStartValues — numbers",
  () => {
    it(
      "starts at the form minimum at full departure",
      () => {
        const start = buildStartValues(
          sketch,
          build(),
          formMeta
        );

        expect( start.grid.columns ).toBe( 2 );
      }
    );

    it(
      "flips to the maximum when the minimum IS the final value",
      () => {
        const atMin = buildStartValues(
          {
            grid: {
              columns: 2
            }
          },
          build( {
            excludeKeys: []
          } ),
          formMeta
        );

        expect( atMin.grid.columns ).toBe( 20 );
      }
    );

    it(
      "departure scales the travel and snaps integer steps",
      () => {
        // final 8, candidate min 2 → travel −6; departure 0.5 → 8 − 3 = 5
        const half = buildStartValues(
          sketch,
          build( {
            departure: 0.5
          } ),
          formMeta
        );

        expect( half.grid.columns ).toBe( 5 );

        // departure 0.1 → 8 − 0.6 = 7.4 → snapped to 7
        const close = buildStartValues(
          sketch,
          build( {
            departure: 0.1
          } ),
          formMeta
        );

        expect( close.grid.columns ).toBe( 7 );
      }
    );

    it(
      "departure 0 is the identity — nothing moves",
      () => {
        const start = buildStartValues(
          sketch,
          build( {
            departure: 0
          } ),
          formMeta
        );

        expect( start.grid.columns ).toBe( 8 );
        expect( start.strokeColor ).toEqual( sketch.strokeColor );
      }
    );

    it(
      "without a form range, heads toward 0 (or 1 when the final is 0)",
      () => {
        const start = buildStartValues(
          {
            amplitude: 100,
            silent: 0
          },
          build( {
            excludeKeys: []
          } ),
          {}
        );

        expect( start.amplitude ).toBe( 0 );
        expect( start.silent ).toBe( 1 );
      }
    );
  }
);

describe(
  "buildStartValues — colors, booleans, strings, vectors",
  () => {
    it(
      "inverts RGB channels and keeps alpha",
      () => {
        const start = buildStartValues(
          sketch,
          build(),
          formMeta
        );

        expect( start.strokeColor ).toEqual( [
          55,
          205,
          205,
          255
        ] );
      }
    );

    it(
      "scales the color inversion by departure",
      () => {
        const half = buildStartValues(
          sketch,
          build( {
            departure: 0.5
          } ),
          formMeta
        );

        // 200 → lerp(200, 55, 0.5) ≈ 128; 50 → lerp(50, 205, 0.5) ≈ 128
        expect( half.strokeColor[ 0 ] ).toBe( 128 );
        expect( half.strokeColor[ 1 ] ).toBe( 128 );
        expect( half.strokeColor[ 3 ] ).toBe( 255 );
      }
    );

    it(
      "flips booleans at departure ≥ 0.5 and keeps strings",
      () => {
        const noExcludes = build( {
          excludeKeys: []
        } );
        const far = buildStartValues(
          sketch,
          noExcludes,
          formMeta
        );

        expect( far.animated ).toBe( false );
        expect( far.mode ).toBe( "smooth" );

        const near = buildStartValues(
          sketch,
          {
            ...noExcludes,
            departure: 0.4
          },
          formMeta
        );

        expect( near.animated ).toBe( true );
      }
    );

    it(
      "resolves vector2d leaves against the pad's axis ranges",
      () => {
        const start = buildStartValues(
          sketch,
          build(),
          formMeta
        );

        // x final 0.5, min 0 → start 0; y final 0.25, min 0 → start 0
        expect( start.grid.position.x ).toBe( 0 );
        expect( start.grid.position.y ).toBe( 0 );

        // a final AT the min flips to the max
        const atMin = buildStartValues(
          {
            grid: {
              position: {
                x: 0,
                y: 0.25
              }
            }
          },
          build(),
          formMeta
        );

        expect( atMin.grid.position.x ).toBe( 1 );
      }
    );
  }
);

describe(
  "buildStartValues — key lists",
  () => {
    it(
      "snap and exclude keys keep their final values",
      () => {
        const start = buildStartValues(
          sketch,
          build(),
          formMeta
        );

        expect( start.seed ).toBe( 42 ); // snapKeys
        expect( start.animated ).toBe( true ); // excludeKeys
      }
    );
  }
);
