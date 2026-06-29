import {
  clamp,
  countFingersUp,
  faceDepthFromBox,
  GESTURE_SOURCE_IDS,
  gestureChannelValues,
  handMetricsFromLandmarks,
  mapClamp
} from "../gestureMath.js";
import {
  INTERACTION_SOURCES
} from "../sources.js";

type Pt = { x: number;
  y: number;
  z: number };

// Build a 21-entry landmark array, overriding the indices the math reads.
function hand( overrides: Record<number, [number, number]> ): Pt[] {
  const points: Pt[] = Array.from(
    {
      length: 21
    },
    () => ( {
      x: 0.5,
      y: 0.5,
      z: 0
    } )
  );

  for ( const [
    index,
    [
      x,
      y
    ]
  ] of Object.entries( overrides ) ) {
    points[ Number( index ) ] = {
      x,
      y,
      z: 0
    };
  }

  return points;
}

// Wrist (0) and palm ref (9) give a hand "scale" of 0.30 → near the camera.
const COMMON = {
  0: [
    0.5,
    0.95
  ] as [number, number],
  9: [
    0.5,
    0.65
  ] as [number, number],
  5: [
    0.44,
    0.62
  ] as [number, number],
  13: [
    0.56,
    0.62
  ] as [number, number],
  17: [
    0.61,
    0.63
  ] as [number, number]
};

const OPEN_HAND = hand( {
  ...COMMON,
  8: [
    0.42,
    0.30
  ], // index tip
  12: [
    0.50,
    0.26
  ], // middle tip
  16: [
    0.58,
    0.30
  ], // ring tip
  20: [
    0.64,
    0.34
  ], // pinky tip
  4: [
    0.18,
    0.45
  ] // thumb tip, out to the side
} );

const FIST = hand( {
  ...COMMON,
  8: [
    0.45,
    0.66
  ], // index tip curled to palm
  12: [
    0.50,
    0.66
  ],
  16: [
    0.55,
    0.66
  ],
  20: [
    0.60,
    0.66
  ],
  4: [
    0.46,
    0.60
  ] // thumb tucked across the palm
} );

describe(
  "handMetricsFromLandmarks",
  () => {
    it(
      "reads an open hand as fully open with five fingers up",
      () => {
        const m = handMetricsFromLandmarks( OPEN_HAND );

        expect( m ).not.toBeNull();
        expect( m!.openness ).toBeGreaterThan( 0.7 );
        expect( countFingersUp( m!.fingerOpen ) ).toBe( 5 );
      }
    );

    it(
      "reads a fist as closed with no fingers up",
      () => {
        const m = handMetricsFromLandmarks( FIST );

        expect( m ).not.toBeNull();
        expect( m!.openness ).toBeLessThan( 0.3 );
        expect( countFingersUp( m!.fingerOpen ) ).toBe( 0 );
      }
    );

    it(
      "suggests greater depth for a larger (nearer) hand",
      () => {
        const near = handMetricsFromLandmarks( OPEN_HAND )!;
        // Same pose, half the apparent size (palm ref pulled toward the wrist).
        const far = handMetricsFromLandmarks( hand( {
          ...COMMON,
          9: [
            0.5,
            0.80
          ],
          8: [
            0.46,
            0.62
          ],
          12: [
            0.50,
            0.60
          ],
          16: [
            0.54,
            0.62
          ],
          20: [
            0.57,
            0.64
          ]
        } ) )!;

        expect( near.depth ).toBeGreaterThan( far.depth );
      }
    );

    it(
      "returns null for missing or degenerate landmarks",
      () => {
        expect( handMetricsFromLandmarks( [] ) ).toBeNull();
        expect( handMetricsFromLandmarks( null as never ) ).toBeNull();
      }
    );
  }
);

describe(
  "mapClamp",
  () => {
    it(
      "remaps within range and clamps outside it",
      () => {
        expect( mapClamp(
          0.5,
          0,
          1,
          0,
          100
        ) ).toBe( 50 );
        expect( mapClamp(
          -1,
          0,
          1,
          0,
          100
        ) ).toBe( 0 );
        expect( mapClamp(
          2,
          0,
          1,
          0,
          100
        ) ).toBe( 100 );
      }
    );

    it(
      "handles a zero-width input range",
      () => {
        expect( mapClamp(
          5,
          1,
          1,
          10,
          20
        ) ).toBe( 10 );
      }
    );
  }
);

describe(
  "clamp",
  () => {
    it(
      "constrains to the bounds",
      () => {
        expect( clamp( -0.5 ) ).toBe( 0 );
        expect( clamp( 1.5 ) ).toBe( 1 );
        expect( clamp( 0.4 ) ).toBe( 0.4 );
      }
    );
  }
);

describe(
  "faceDepthFromBox",
  () => {
    it(
      "grows toward 1 as the face fills the frame",
      () => {
        expect( faceDepthFromBox(
          0,
          320
        ) ).toBe( 0 );
        expect( faceDepthFromBox(
          320,
          320
        ) ).toBe( 1 );
        expect( faceDepthFromBox(
          0,
          0
        ) ).toBe( 0 );
      }
    );
  }
);

describe(
  "gestureChannelValues",
  () => {
    const metrics = {
      hands: {
        count: 2,
        open: 1,
        openness: 0.5,
        fingers: 10,
        depth: 0.4
      },
      hand: {
        pinch: 0.7,
        spread: 0.3
      },
      face: {
        count: 4,
        depth: 0.9
      }
    };

    it(
      "normalizes every channel to 0..1, dividing counts by their maxima",
      () => {
        const ch = gestureChannelValues( metrics );

        expect( ch[ "hands.count" ] ).toBe( 1 ); // 2 / 2
        expect( ch[ "hands.open" ] ).toBe( 0.5 ); // 1 / 2
        expect( ch[ "hands.openness" ] ).toBe( 0.5 ); // passthrough
        expect( ch[ "hands.fingers" ] ).toBe( 1 ); // 10 / 10
        expect( ch[ "hands.depth" ] ).toBe( 0.4 );
        expect( ch[ "hands.pinch" ] ).toBe( 0.7 );
        expect( ch[ "hands.spread" ] ).toBe( 0.3 );
        expect( ch[ "face.count" ] ).toBe( 1 ); // 4 / 4
        expect( ch[ "face.depth" ] ).toBe( 0.9 );

        for ( const value of Object.values( ch ) ) {
          expect( value ).toBeGreaterThanOrEqual( 0 );
          expect( value ).toBeLessThanOrEqual( 1 );
        }
      }
    );

    it(
      "emits exactly the canonical gesture channel ids",
      () => {
        expect( Object.keys( gestureChannelValues( metrics ) ).sort() )
          .toEqual( [
            ...GESTURE_SOURCE_IDS
          ].sort() );
      }
    );

    it(
      "is all zeros for an empty snapshot",
      () => {
        const ch = gestureChannelValues( {} );

        for ( const value of Object.values( ch ) ) {
          expect( value ).toBe( 0 );
        }
      }
    );
  }
);

describe(
  "gesture source manifest parity",
  () => {
    it(
      "exposes every gesture channel id as a scalar source in the manifest",
      () => {
        const scalarIds = INTERACTION_SOURCES
          .filter( ( s ) => s.type === "scalar" )
          .map( ( s ) => s.id );

        for ( const id of GESTURE_SOURCE_IDS ) {
          expect( scalarIds ).toContain( id );
        }
      }
    );
  }
);
