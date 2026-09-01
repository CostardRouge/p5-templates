import {
  fractionToValue,
  randomVector2D,
  resolveAxes,
  stepDecimals,
  valueToFraction,
  type AxisRange
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
  "resolveAxes",
  () => {
    it(
      "spans [-1, 1] on both axes by default",
      () => {
        expect( resolveAxes( {} ) ).toEqual( {
          xAxis: signed,
          yAxis: signed
        } );
      }
    );

    it(
      "starts at 0 when negatives are not allowed",
      () => {
        expect( resolveAxes( {
          allowNegative: false
        } ) ).toEqual( {
          xAxis: unsigned,
          yAxis: unsigned
        } );
      }
    );

    it(
      "layers per-axis overrides over the shared bounds",
      () => {
        expect( resolveAxes( {
          min: 0,
          max: 10,
          step: 1,
          yAxis: {
            max: 4
          }
        } ) ).toEqual( {
          xAxis: {
            min: 0,
            max: 10,
            step: 1
          },
          yAxis: {
            min: 0,
            max: 4,
            step: 1
          }
        } );
      }
    );
  }
);

describe(
  "randomVector2D",
  () => {
    // Successive draws, so a swapped or reused axis shows up as a wrong value.
    const drawsOf = ( ...fractions: number[] ) => {
      let index = 0;

      return () => fractions[ index++ ] ?? 0;
    };

    it(
      "maps the two draws to x then y, snapped to each axis' step",
      () => {
        expect( randomVector2D(
          {},
          drawsOf(
            0.314,
            0.777
          )
        ) ).toEqual( {
          x: -0.37,
          y: 0.55
        } );
      }
    );

    it(
      "honours per-axis bounds and steps",
      () => {
        expect( randomVector2D(
          {
            allowNegative: false,
            min: 0,
            max: 10,
            step: 1,
            yAxis: {
              max: 4
            }
          },
          drawsOf(
            0.62,
            0.5
          )
        ) ).toEqual( {
          x: 6,
          y: 2
        } );
      }
    );

    it(
      "stays inside the pad for the extreme draws",
      () => {
        expect( randomVector2D(
          {},
          drawsOf(
            0,
            1
          )
        ) ).toEqual( {
          x: -1,
          y: 1
        } );
      }
    );

    it(
      "ignores yDown, which only mirrors the pad's rendering",
      () => {
        const draws = [
          0.25,
          0.25
        ];

        expect( randomVector2D(
          {
            allowNegative: false,
            yDown: true
          },
          drawsOf( ...draws )
        ) ).toEqual( randomVector2D(
          {
            allowNegative: false
          },
          drawsOf( ...draws )
        ) );
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
