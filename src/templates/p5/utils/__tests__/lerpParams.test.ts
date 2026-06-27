import lerpParamsImpl, {
  lerpParamsStaggered as lerpParamsStaggeredImpl
} from "@/p5/utils/slides/morph/lerpParams.js";

// The util is untyped JS; give it a call signature so the assertions below can
// read the dynamic result shape.
const lerpParams = lerpParamsImpl as (
  from: Record<string, unknown>,
  to: Record<string, unknown>,
  t: number,
  snapKeys?: string[]
) => any;

const lerpParamsStaggered = lerpParamsStaggeredImpl as (
  from: Record<string, unknown>,
  to: Record<string, unknown>,
  t: number,
  snapKeys?: string[],
  spread?: number
) => any;

describe(
  "lerpParams",
  () => {
    test(
      "lerps numbers at t = 0, 0.5, 1",
      () => {
        expect( lerpParams(
          {
            a: 0
          },
          {
            a: 10
          },
          0
        ).a ).toBe( 0 );
        expect( lerpParams(
          {
            a: 0
          },
          {
            a: 10
          },
          0.5
        ).a ).toBe( 5 );
        expect( lerpParams(
          {
            a: 0
          },
          {
            a: 10
          },
          1
        ).a ).toBe( 10 );
      }
    );

    test(
      "lerps colour arrays component-wise, preserving length",
      () => {
        const rgb = lerpParams(
          {
            c: [
              0,
              0,
              0
            ]
          },
          {
            c: [
              10,
              20,
              30
            ]
          },
          0.5
        ).c;
        const rgba = lerpParams(
          {
            c: [
              0,
              0,
              0,
              0
            ]
          },
          {
            c: [
              10,
              20,
              30,
              40
            ]
          },
          0.5
        ).c;

        expect( rgb ).toEqual( [
          5,
          10,
          15
        ] );
        expect( rgba ).toEqual( [
          5,
          10,
          15,
          20
        ] );
      }
    );

    test(
      "lerps equal-length numeric arrays element-wise",
      () => {
        expect( lerpParams(
          {
            v: [
              0,
              100
            ]
          },
          {
            v: [
              10,
              200
            ]
          },
          0.5
        ).v ).toEqual( [
          5,
          150
        ] );
      }
    );

    test(
      "snaps mismatched-length arrays at the t < 0.5 boundary",
      () => {
        const from = {
          v: [
            1,
            2
          ]
        };
        const to = {
          v: [
            1,
            2,
            3
          ]
        };

        expect( lerpParams(
          from,
          to,
          0.49
        ).v ).toEqual( [
          1,
          2
        ] );
        expect( lerpParams(
          from,
          to,
          0.5
        ).v ).toEqual( [
          1,
          2,
          3
        ] );
      }
    );

    test(
      "snaps booleans, strings and enums at the boundary",
      () => {
        expect( lerpParams(
          {
            b: false
          },
          {
            b: true
          },
          0.49
        ).b ).toBe( false );
        expect( lerpParams(
          {
            b: false
          },
          {
            b: true
          },
          0.5
        ).b ).toBe( true );

        expect( lerpParams(
          {
            mode: "drift"
          },
          {
            mode: "orbit"
          },
          0.4
        ).mode ).toBe( "drift" );
        expect( lerpParams(
          {
            mode: "drift"
          },
          {
            mode: "orbit"
          },
          0.6
        ).mode ).toBe( "orbit" );
      }
    );

    test(
      "snaps when the two sides have different types",
      () => {
        expect( lerpParams(
          {
            x: 1
          },
          {
            x: "two"
          },
          0.6
        ).x ).toBe( "two" );
      }
    );

    test(
      "snapKeys force a numeric param to snap (full path and leaf name)",
      () => {
        // Full dotted path.
        expect( lerpParams(
          {
            seed: 1
          },
          {
            seed: 9
          },
          0.4,
          [
            "seed"
          ]
        ).seed ).toBe( 1 );

        // Leaf name matches a nested path.
        const nested = lerpParams(
          {
            sites: {
              seed: 1,
              motion: 0
            }
          },
          {
            sites: {
              seed: 9,
              motion: 10
            }
          },
          0.6,
          [
            "seed"
          ]
        );

        expect( nested.sites.seed ).toBe( 9 ); // snapped (t >= 0.5)
        expect( nested.sites.motion ).toBe( 6 ); // still lerped
      }
    );

    test(
      "recurses into nested plain objects",
      () => {
        const out = lerpParams(
          {
            a: {
              b: 0
            }
          },
          {
            a: {
              b: 10
            }
          },
          0.5
        );

        expect( out.a.b ).toBe( 5 );
      }
    );

    test(
      "passes through a key present on only one side (no NaN)",
      () => {
        const out = lerpParams(
          {
            only: 5
          },
          {
            other: 9
          },
          0.5
        );

        expect( out.only ).toBe( 5 );
        expect( out.other ).toBe( 9 );
      }
    );
  }
);

describe(
  "lerpParamsStaggered",
  () => {
    test(
      "matches a plain lerp when spread is 0",
      () => {
        expect( lerpParamsStaggered(
          {
            a: 0,
            b: 0
          },
          {
            a: 10,
            b: 10
          },
          0.5,
          [],
          0
        ) ).toEqual( {
          a: 5,
          b: 5
        } );
      }
    );

    test(
      "falls back to a plain lerp with a single group",
      () => {
        expect( lerpParamsStaggered(
          {
            a: 0
          },
          {
            a: 10
          },
          0.5,
          [],
          0.5
        ) ).toEqual( {
          a: 5
        } );
      }
    );

    test(
      "offsets groups so the leading one is ahead of the trailing one",
      () => {
        // keys [a, b], spread 0.5, global 0.5 → a done, b not started.
        expect( lerpParamsStaggered(
          {
            a: 0,
            b: 0
          },
          {
            a: 10,
            b: 10
          },
          0.5,
          [],
          0.5
        ) ).toEqual( {
          a: 10,
          b: 0
        } );
      }
    );

    test(
      "all groups settle at the segment endpoints",
      () => {
        const from = {
          a: 0,
          b: 0
        };
        const to = {
          a: 10,
          b: 10
        };

        expect( lerpParamsStaggered(
          from,
          to,
          0,
          [],
          0.5
        ) ).toEqual( {
          a: 0,
          b: 0
        } );
        expect( lerpParamsStaggered(
          from,
          to,
          1,
          [],
          0.5
        ) ).toEqual( {
          a: 10,
          b: 10
        } );
      }
    );

    test(
      "still honours snapKeys within a staggered group",
      () => {
        // keys [x, seed]; at global 0.6 the trailing seed group is < 0.5 so it
        // snaps to `from`, while x has already completed.
        const out = lerpParamsStaggered(
          {
            x: 0,
            seed: 1
          },
          {
            x: 10,
            seed: 9
          },
          0.6,
          [
            "seed"
          ],
          0.5
        );

        expect( out.x ).toBe( 10 );
        expect( out.seed ).toBe( 1 );
      }
    );
  }
);
