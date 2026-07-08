import {
  fractionToValue, stepDecimals, valueToFraction, type AxisRange
} from "../utils/vector2dMath";

const signed: AxisRange = {
  min: -1,
  max: 1,
  step: 0.01
};

const unsigned: AxisRange = {
  min: 0,
  max: 1,
  step: 0.01
};

describe(
  "valueToFraction",
  () => {
    it(
      "maps min to 0, max to 1 and the midpoint to 0.5",
      () => {
        expect( valueToFraction(
          -1,
          signed
        ) ).toBe( 0 );
        expect( valueToFraction(
          1,
          signed
        ) ).toBe( 1 );
        expect( valueToFraction(
          0,
          signed
        ) ).toBe( 0.5 );
      }
    );

    it(
      "places the origin at the bottom-left for an unsigned axis",
      () => {
        expect( valueToFraction(
          0,
          unsigned
        ) ).toBe( 0 );
        expect( valueToFraction(
          0.5,
          unsigned
        ) ).toBe( 0.5 );
      }
    );

    it(
      "clamps out-of-range values into [0, 1]",
      () => {
        expect( valueToFraction(
          -5,
          signed
        ) ).toBe( 0 );
        expect( valueToFraction(
          5,
          signed
        ) ).toBe( 1 );
      }
    );

    it(
      "returns 0 for a degenerate (zero-width) range",
      () => {
        expect( valueToFraction(
          3,
          {
            min: 2,
            max: 2
          }
        ) ).toBe( 0 );
      }
    );
  }
);

describe(
  "fractionToValue",
  () => {
    it(
      "is the inverse of valueToFraction at the bounds and centre",
      () => {
        expect( fractionToValue(
          0,
          signed
        ) ).toBe( -1 );
        expect( fractionToValue(
          1,
          signed
        ) ).toBe( 1 );
        expect( fractionToValue(
          0.5,
          signed
        ) ).toBe( 0 );
      }
    );

    it(
      "snaps to the configured step without floating-point noise",
      () => {
        // 0.314 of [-1, 1] is -0.372, which snaps cleanly to two decimals.
        expect( fractionToValue(
          0.314,
          signed
        ) ).toBe( -0.37 );
        expect( fractionToValue(
          0.777,
          unsigned
        ) ).toBe( 0.78 );
      }
    );

    it(
      "honours a coarser step",
      () => {
        expect( fractionToValue(
          0.62,
          {
            min: 0,
            max: 10,
            step: 1
          }
        ) ).toBe( 6 );
      }
    );

    it(
      "clamps the fraction before mapping",
      () => {
        expect( fractionToValue(
          -2,
          signed
        ) ).toBe( -1 );
        expect( fractionToValue(
          2,
          signed
        ) ).toBe( 1 );
      }
    );

    it(
      "round-trips snapped values through valueToFraction",
      () => {
        const value = fractionToValue(
          0.42,
          signed
        );

        expect( fractionToValue(
          valueToFraction(
            value,
            signed
          ),
          signed
        ) ).toBe( value );
      }
    );
  }
);

describe(
  "stepDecimals",
  () => {
    it(
      "derives the decimal count from the step",
      () => {
        expect( stepDecimals( 1 ) ).toBe( 0 );
        expect( stepDecimals( 0.5 ) ).toBe( 1 );
        expect( stepDecimals( 0.01 ) ).toBe( 2 );
      }
    );

    it(
      "defaults to 2 decimals when the step is missing or invalid",
      () => {
        expect( stepDecimals( undefined ) ).toBe( 2 );
        expect( stepDecimals( 0 ) ).toBe( 2 );
        expect( stepDecimals( Number.NaN ) ).toBe( 2 );
      }
    );
  }
);
