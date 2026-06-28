import lerpParamsImpl, {
  lerpParamsSequenced as lerpParamsSequencedImpl
} from "@/p5/utils/slides/morph/lerpParams.js";

// The util is untyped JS; give it a call signature so the assertions below can
// read the dynamic result shape.
const lerpParams = lerpParamsImpl as (
  from: Record<string, unknown>,
  to: Record<string, unknown>,
  t: number,
  snapKeys?: string[]
) => any;

const lerpParamsSequenced = lerpParamsSequencedImpl as (
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
  "lerpParamsSequenced",
  () => {
    test(
      "matches a plain lerp when spread is 0",
      () => {
        expect( lerpParamsSequenced(
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
      "falls back to a plain lerp when only one param changes",
      () => {
        // `b` is identical on both sides, so only `a` changes → nothing to
        // sequence, `a` morphs across the whole window.
        expect( lerpParamsSequenced(
          {
            a: 0,
            b: 5
          },
          {
            a: 10,
            b: 5
          },
          0.5,
          [],
          1
        ) ).toEqual( {
          a: 5,
          b: 5
        } );
      }
    );

    test(
      "spread 1 changes params one at a time: the first finishes before the next starts",
      () => {
        // changing leaves [a, b], spread 1, t 0.5 → a's [0,0.5] slice is done,
        // b's [0.5,1] slice hasn't started.
        expect( lerpParamsSequenced(
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
          1
        ) ).toEqual( {
          a: 10,
          b: 0
        } );
      }
    );

    test(
      "sequences leaves nested in the same group independently",
      () => {
        // The case top-level grouping missed: two leaves under one object still
        // change one after another.
        const out = lerpParamsSequenced(
          {
            sites: {
              count: 0,
              speed: 0
            }
          },
          {
            sites: {
              count: 10,
              speed: 10
            }
          },
          0.5,
          [],
          1
        );

        expect( out.sites.count ).toBe( 10 );
        expect( out.sites.speed ).toBe( 0 );
      }
    );

    test(
      "only counts leaves that actually differ toward the slice count",
      () => {
        // `b` is unchanged, so a and c split the window in half (not thirds).
        const out = lerpParamsSequenced(
          {
            a: 0,
            b: 5,
            c: 0
          },
          {
            a: 10,
            b: 5,
            c: 10
          },
          0.5,
          [],
          1
        );

        expect( out ).toEqual( {
          a: 10,
          b: 5,
          c: 0
        } );
      }
    );

    test(
      "every param settles at the transition endpoints",
      () => {
        const from = {
          a: 0,
          b: 0
        };
        const to = {
          a: 10,
          b: 10
        };

        expect( lerpParamsSequenced(
          from,
          to,
          0,
          [],
          1
        ) ).toEqual( {
          a: 0,
          b: 0
        } );
        expect( lerpParamsSequenced(
          from,
          to,
          1,
          [],
          1
        ) ).toEqual( {
          a: 10,
          b: 10
        } );
      }
    );

    test(
      "still honours snapKeys within the sequence",
      () => {
        // changing leaves [x, seed]; at t 0.6 the seed slice [0.5,1] is < 0.5 so
        // it snaps to `from`, while x has already completed.
        const out = lerpParamsSequenced(
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
          1
        );

        expect( out.x ).toBe( 10 );
        expect( out.seed ).toBe( 1 );
      }
    );
  }
);
