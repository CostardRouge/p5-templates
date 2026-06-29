import staggeredProgress from "@/p5/utils/slides/morph/staggeredProgress.js";

describe(
  "staggeredProgress",
  () => {
    test(
      "is the identity when spread is 0",
      () => {
        expect( staggeredProgress(
          0.5,
          0.3,
          0
        ) ).toBe( 0.5 );
      }
    );

    test(
      "leading group (keyPos 0) runs ahead, trailing group (keyPos 1) lags",
      () => {
        // spread 0.5 → span 0.5.
        // keyPos 0: start 0   → (0.25)/0.5 = 0.5
        expect( staggeredProgress(
          0.25,
          0,
          0.5
        ) ).toBeCloseTo( 0.5 );

        // keyPos 1: start 0.5 → (0.5-0.5)/0.5 = 0 at global 0.5, 0.5 at global 0.75
        expect( staggeredProgress(
          0.5,
          1,
          0.5
        ) ).toBe( 0 );
        expect( staggeredProgress(
          0.75,
          1,
          0.5
        ) ).toBeCloseTo( 0.5 );
      }
    );

    test(
      "every group settles to 0 at global 0 and 1 at global 1",
      () => {
        for ( const keyPos of [
          0,
          0.5,
          1
        ] ) {
          expect( staggeredProgress(
            0,
            keyPos,
            0.5
          ) ).toBe( 0 );
          expect( staggeredProgress(
            1,
            keyPos,
            0.5
          ) ).toBe( 1 );
        }
      }
    );

    test(
      "spread of 1 degenerates to a step at the group's start",
      () => {
        expect( staggeredProgress(
          0.4,
          0.5,
          1
        ) ).toBe( 0 );
        expect( staggeredProgress(
          0.6,
          0.5,
          1
        ) ).toBe( 1 );
      }
    );
  }
);
