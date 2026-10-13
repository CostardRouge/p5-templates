import {
  backgroundFromColor,
  backgroundGeometry,
  isBackgroundObject,
  normalizeBackground
} from "../backgroundSpec.js";

const frame = {
  width: 400,
  height: 500
};

// Every number in a geometry, in order, to compare two frames within float
// noise (cos(2π · 2) is not exactly 1).
const numbers = ( geometry: object ): number[] => JSON.stringify( geometry ).match( /-?\d+(\.\d+)?(e-?\d+)?/g )
  ?.map( Number ) ?? [];

describe(
  "background values",
  () => {
    it(
      "reads a stored colour array as a solid background",
      () => {
        expect( isBackgroundObject( [
          1,
          2,
          3
        ] ) ).toBe( false );

        const solid = normalizeBackground( [
          10,
          20,
          30
        ] );

        expect( solid.kind ).toBe( "solid" );
        expect( solid.from ).toEqual( [
          10,
          20,
          30,
          255
        ] );
      }
    );

    it(
      "promotes a colour to a gradient that starts on it and lifts a dark one",
      () => {
        const value = backgroundFromColor(
          [
            0,
            0,
            0
          ],
          "radial"
        );

        expect( value.kind ).toBe( "radial" );
        expect( value.from ).toEqual( [
          0,
          0,
          0
        ] );
        expect( value.to[ 0 ] ).toBeGreaterThan( 0 );
        expect( backgroundFromColor( [
          250,
          250,
          250
        ] ).to[ 0 ] ).toBeLessThan( 250 );
      }
    );
  }
);

describe(
  "background geometry",
  () => {
    const value = normalizeBackground( {
      kind: "linear",
      from: [
        0,
        0,
        0
      ],
      to: [
        200,
        100,
        0
      ],
      angle: 180
    } );

    it(
      "runs a 180° line from the top edge to the bottom edge",
      () => {
        const {
          line
        } = backgroundGeometry(
          value,
          frame
        );

        expect( line?.[ 0 ] ).toBeCloseTo( 200 );
        expect( line?.[ 1 ] ).toBeCloseTo( 0 );
        expect( line?.[ 2 ] ).toBeCloseTo( 200 );
        expect( line?.[ 3 ] ).toBeCloseTo( 500 );
      }
    );

    it(
      "stops at the first colour with no strength and reaches the second at full strength",
      () => {
        const flat = backgroundGeometry(
          {
            ...value,
            strength: 0
          },
          frame
        );
        const full = backgroundGeometry(
          value,
          frame
        );

        expect( flat.stops.at( -1 )?.color ).toEqual( [
          0,
          0,
          0,
          255
        ] );
        expect( full.stops.at( -1 )?.color ).toEqual( [
          200,
          100,
          0,
          255
        ] );
        expect( full.stops[ 12 ].color[ 0 ] ).toBeCloseTo( 100 );
      }
    );

    it(
      "shapes the stops with the easing",
      () => {
        const eased = backgroundGeometry(
          value,
          {
            ...frame,
            ease: ( x: number ) => x * x
          }
        );

        expect( eased.stops[ 12 ].color[ 0 ] ).toBeCloseTo( 50 );
      }
    );

    it.each( [
      "rotate",
      "drift",
      "breathe"
    ] )(
      "closes the loop when it %ss: phase 0 and phase 1 paint the same",
      ( motion ) => {
        const moving = {
          ...value,
          kind: motion === "rotate" ? "radial" : "linear",
          motion,
          cycles: 2
        };

        const start = numbers( backgroundGeometry(
          moving,
          {
            ...frame,
            phase: 0
          }
        ) );
        const end = numbers( backgroundGeometry(
          moving,
          {
            ...frame,
            phase: 1
          }
        ) );

        expect( end ).toHaveLength( start.length );
        end.forEach( (
          n, i
        ) => expect( n ).toBeCloseTo(
          start[ i ],
          6
        ) );
        expect( backgroundGeometry(
          moving,
          {
            ...frame,
            phase: 0.25
          }
        ) ).not.toEqual( backgroundGeometry(
          moving,
          {
            ...frame,
            phase: 0
          }
        ) );
      }
    );

    it(
      "sizes a radial gradient to the farthest corner",
      () => {
        const {
          circle
        } = backgroundGeometry(
          normalizeBackground( {
            ...value,
            kind: "radial",
            center: {
              x: 0,
              y: 0
            },
            radius: 1
          } ),
          frame
        );

        expect( circle?.[ 2 ] ).toBeCloseTo( Math.hypot(
          400,
          500
        ) );
      }
    );
  }
);
