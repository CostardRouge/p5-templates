import sequenceProgress from "@/p5/utils/slides/morph/sequenceProgress.js";

describe(
  "sequenceProgress",
  () => {
    test(
      "is the identity when spread is 0",
      () => {
        expect( sequenceProgress(
          0.5,
          0,
          3,
          0
        ) ).toBe( 0.5 );
      }
    );

    test(
      "is the identity with a single item",
      () => {
        expect( sequenceProgress(
          0.4,
          0,
          1,
          1
        ) ).toBe( 0.4 );
      }
    );

    test(
      "spread 1 gives even, non-overlapping slices (one at a time)",
      () => {
        // count 2 → item 0 over [0, 0.5], item 1 over [0.5, 1].
        expect( sequenceProgress(
          0.25,
          0,
          2,
          1
        ) ).toBeCloseTo( 0.5 );
        expect( sequenceProgress(
          0.5,
          0,
          2,
          1
        ) ).toBe( 1 );

        expect( sequenceProgress(
          0.5,
          1,
          2,
          1
        ) ).toBe( 0 );
        expect( sequenceProgress(
          0.75,
          1,
          2,
          1
        ) ).toBeCloseTo( 0.5 );
      }
    );

    test(
      "every item settles to 0 at t=0 and 1 at t=1",
      () => {
        for ( const index of [
          0,
          1,
          2
        ] ) {
          expect( sequenceProgress(
            0,
            index,
            3,
            1
          ) ).toBe( 0 );
          expect( sequenceProgress(
            1,
            index,
            3,
            1
          ) ).toBe( 1 );
        }
      }
    );

    test(
      "intermediate spread keeps the windows partially overlapping",
      () => {
        // count 2, spread 0.5 → width 0.75, item 1 starts at 0.25.
        expect( sequenceProgress(
          0.25,
          1,
          2,
          0.5
        ) ).toBe( 0 );
        expect( sequenceProgress(
          0.25,
          0,
          2,
          0.5
        ) ).toBeCloseTo( 1 / 3 );
      }
    );
  }
);
