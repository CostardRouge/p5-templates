/**
 * Unit tests for the silhouettes: the primitives, the entity builders fed
 * synthetic landmarks, the presence shaping and the mask processing. The claim
 * under test is the one the sketch is built on: a hand lifts the sheet as a
 * SURFACE (palm and fingers), and the gap between two spread fingers stays
 * down.
 */
import {
  FACE_OVAL,
  bodyEntity,
  capsule,
  cursorEntity,
  disc,
  ellipse,
  entityDistance,
  faceBoxEntity,
  faceEntity,
  handEntity,
  makeEntity,
  maskPresenceAt,
  polygon,
  primitiveDistance,
  processMask,
  shapePresence
} from "@/p5/sketches/sculpt/_silhouette.js";

describe(
  "primitiveDistance",
  () => {
    it(
      "is negative inside and measures to the edge",
      () => {
        expect( primitiveDistance(
          disc(
            0,
            0,
            2
          ),
          0,
          0
        ) ).toBe( -2 );
        expect( primitiveDistance(
          disc(
            0,
            0,
            2
          ),
          5,
          0
        ) ).toBe( 3 );

        const cap = capsule(
          0,
          0,
          4,
          0,
          1
        );

        expect( primitiveDistance(
          cap,
          2,
          1
        ) ).toBeCloseTo(
          0,
          9
        );
        expect( primitiveDistance(
          cap,
          2,
          0
        ) ).toBe( -1 );
        expect( primitiveDistance(
          cap,
          6,
          0
        ) ).toBe( 1 );

        const square = polygon(
          [
            0,
            0,
            4,
            0,
            4,
            4,
            0,
            4
          ],
          0.5
        );

        expect( primitiveDistance(
          square,
          2,
          2
        ) ).toBeCloseTo(
          -2.5,
          9
        );
        expect( primitiveDistance(
          square,
          6,
          2
        ) ).toBeCloseTo(
          1.5,
          9
        );

        const oval = ellipse(
          0,
          0,
          4,
          2
        );

        expect( primitiveDistance(
          oval,
          4,
          0
        ) ).toBeCloseTo(
          0,
          9
        );
        expect( primitiveDistance(
          oval,
          0,
          3
        ) ).toBeCloseTo(
          1,
          9
        );
      }
    );
  }
);

describe(
  "makeEntity / entityDistance",
  () => {
    const entity = makeEntity(
      [
        disc(
          0,
          0,
          1
        ),
        disc(
          6,
          0,
          1
        )
      ],
      "test"
    );

    it(
      "measures the footprint",
      () => {
        expect( entity.minX ).toBe( -1 );
        expect( entity.maxX ).toBe( 7 );
        expect( entity.cx ).toBe( 3 );
        expect( entity.cz ).toBe( 0 );
        expect( entity.radius ).toBeCloseTo(
          Math.hypot(
            8,
            2
          ) / 2,
          9
        );
      }
    );

    it(
      "takes the nearest primitive and rejects points past the padding",
      () => {
        // Between the two discs, past every primitive's padded box: "far".
        expect( entityDistance(
          entity,
          3,
          0
        ) ).toBe( Infinity );
        expect( entityDistance(
          entity,
          3,
          0,
          2
        ) ).toBe( 2 );
        expect( entityDistance(
          entity,
          6,
          0
        ) ).toBe( -1 );
        expect( entityDistance(
          entity,
          7.5,
          0,
          0.2
        ) ).toBe( Infinity );
        expect( entityDistance(
          entity,
          7.5,
          0,
          1
        ) ).toBe( 0.5 );
      }
    );
  }
);

describe(
  "shapePresence",
  () => {
    it(
      "is 1 inside, feathers outside, and 0 past the feather",
      () => {
        const cfg = {
          feather: 1,
          profile: "plateau"
        };

        expect( shapePresence(
          -3,
          cfg
        ) ).toBe( 1 );
        expect( shapePresence(
          0,
          cfg
        ) ).toBe( 1 );
        expect( shapePresence(
          0.5,
          cfg
        ) ).toBeCloseTo(
          0.5,
          9
        );
        expect( shapePresence(
          1,
          cfg
        ) ).toBe( 0 );
        expect( shapePresence(
          Infinity,
          cfg
        ) ).toBe( 0 );
        expect( shapePresence(
          0.5,
          {
            feather: 0,
            profile: "plateau"
          }
        ) ).toBe( 0 );
      }
    );

    it(
      "rises toward the middle for a dome and stays on the edge for a rim",
      () => {
        const dome = {
          feather: 1,
          profile: "dome",
          dome: 2
        };

        expect( shapePresence(
          0,
          dome
        ) ).toBe( 0 );
        expect( shapePresence(
          -1,
          dome
        ) ).toBeCloseTo(
          0.5,
          9
        );
        expect( shapePresence(
          -2,
          dome
        ) ).toBe( 1 );

        const rim = {
          feather: 1,
          profile: "rim",
          rim: 1
        };

        expect( shapePresence(
          -0.25,
          rim
        ) ).toBe( 1 );
        expect( shapePresence(
          -1,
          rim
        ) ).toBe( 0 );
        expect( shapePresence(
          -3,
          rim
        ) ).toBe( 0 );
        expect( shapePresence(
          0.5,
          rim
        ) ).toBeCloseTo(
          0.5,
          9
        );
      }
    );
  }
);

// A canonical open hand in sheet units: the wrist at the origin, the middle
// finger straight up (toward -z), the other fingers fanned out. Knuckles sit
// 10 units from the wrist, so the scale is 10 and a finger's radius 1.
function syntheticHand() {
  const pts: Array<{ x: number,
    z: number }> = new Array( 21 ).fill( null )
    .map( () => ( {
      x: 0,
      z: 0
    } ) );
  const finger = (
    base: number, angle: number, length: number
  ) => {
    const dir = [
      Math.sin( angle ),
      -Math.cos( angle )
    ];
    const start = [
      dir[ 0 ] * 10,
      dir[ 1 ] * 10
    ];

    for ( let i = 0; i < 4; i++ ) {
      pts[ base + i ] = {
        x: start[ 0 ] + dir[ 0 ] * length * ( i / 3 ),
        z: start[ 1 ] + dir[ 1 ] * length * ( i / 3 )
      };
    }
  };

  finger(
    1,
    -0.9,
    7
  ); // thumb
  finger(
    5,
    -0.35,
    9
  ); // index
  finger(
    9,
    0,
    10
  ); // middle
  finger(
    13,
    0.3,
    9
  ); // ring
  finger(
    17,
    0.6,
    7
  ); // pinky

  return pts;
}

describe(
  "handEntity",
  () => {
    const hand = handEntity( syntheticHand() );

    it(
      "traces the fingers and the palm as one surface",
      () => {
        expect( hand ).not.toBeNull();
        expect( hand!.kind ).toBe( "hand" );
        // 5 fingers × 3 phalanges + the palm.
        expect( hand!.prims.length ).toBe( 16 );

        const middleTip = syntheticHand()[ 12 ];
        const palmCentre = {
          x: 0,
          z: -5
        };

        // On the middle finger, halfway along its second phalanx.
        expect( entityDistance(
          hand!,
          0,
          -15
        ) ).toBeLessThan( 0 );
        expect( entityDistance(
          hand!,
          middleTip.x,
          middleTip.z
        ) ).toBeLessThan( 0 );
        expect( entityDistance(
          hand!,
          palmCentre.x,
          palmCentre.z
        ) ).toBeLessThan( 0 );
      }
    );

    it(
      "leaves the gap between two spread fingers down",
      () => {
        // Between the index and middle fingertips, well clear of both.
        const pts = syntheticHand();
        const gap = {
          x: ( pts[ 8 ].x + pts[ 12 ].x ) / 2,
          z: ( pts[ 8 ].z + pts[ 12 ].z ) / 2
        };
        const d = entityDistance(
          hand!,
          gap.x,
          gap.z
        );

        expect( d ).toBeGreaterThan( 1 );
        expect( shapePresence(
          d,
          {
            feather: 0.5,
            profile: "plateau"
          }
        ) ).toBe( 0 );
      }
    );

    it(
      "scales the fingers with the thickness option",
      () => {
        const fat = handEntity(
          syntheticHand(),
          {
            thickness: 2
          }
        );
        const pts = syntheticHand();
        const beside = {
          x: pts[ 10 ].x + 1.5,
          z: pts[ 10 ].z
        };

        expect( entityDistance(
          hand!,
          beside.x,
          beside.z
        ) ).toBeGreaterThan( 0 );
        expect( entityDistance(
          fat!,
          beside.x,
          beside.z
        ) ).toBeLessThan( 0 );
      }
    );

    it(
      "is null without a wrist or a middle knuckle",
      () => {
        expect( handEntity( [] ) ).toBeNull();
      }
    );
  }
);

describe(
  "faceEntity",
  () => {
    it(
      "fills the face oval",
      () => {
        const pts: Array<{ x: number,
          z: number }> = new Array( 468 ).fill( null )
          .map( () => ( {
            x: 100,
            z: 100
          } ) );

        FACE_OVAL.forEach( (
          index, i
        ) => {
          const a = ( i / FACE_OVAL.length ) * Math.PI * 2;

          pts[ index ] = {
            x: 10 + Math.cos( a ) * 4,
            z: 10 + Math.sin( a ) * 5
          };
        } );

        const face = faceEntity( pts );

        expect( face ).not.toBeNull();
        expect( face!.kind ).toBe( "face" );
        expect( entityDistance(
          face!,
          10,
          10
        ) ).toBeLessThan( -3 );
        expect( entityDistance(
          face!,
          10,
          18
        ) ).toBeGreaterThan( 2 );
        expect( face!.cx ).toBeCloseTo(
          10,
          6
        );
      }
    );

    it(
      "falls back to an ellipse on a detector box",
      () => {
        const face = faceBoxEntity(
          5,
          5,
          4,
          6
        );

        expect( entityDistance(
          face,
          5,
          5
        ) ).toBeCloseTo(
          -2,
          9
        );
        expect( entityDistance(
          face,
          7,
          5
        ) ).toBeCloseTo(
          0,
          9
        );
      }
    );

    it(
      "is null without the contour",
      () => {
        expect( faceEntity( [] ) ).toBeNull();
      }
    );
  }
);

describe(
  "bodyEntity",
  () => {
    const pose = (): Array<{ x: number,
      z: number,
      visibility?: number }> => {
      const pts = new Array( 33 ).fill( null )
        .map( () => ( {
          x: 0,
          z: 0,
          visibility: 0
        } ) );
      const put = (
        i: number, x: number, z: number, visibility = 1
      ) => {
        pts[ i ] = {
          x,
          z,
          visibility
        };
      };

      put(
        0,
        10,
        2
      ); // nose
      put(
        7,
        9,
        2
      );
      put(
        8,
        11,
        2
      ); // ears
      put(
        11,
        7,
        5
      );
      put(
        12,
        13,
        5
      ); // shoulders
      put(
        13,
        5,
        9
      );
      put(
        14,
        15,
        9
      ); // elbows
      put(
        15,
        4,
        13
      );
      put(
        16,
        16,
        13,
        0.1
      ); // wrists, the right one barely seen
      put(
        23,
        8,
        14
      );
      put(
        24,
        12,
        14
      ); // hips

      return pts;
    };

    it(
      "fills the torso, the head and the visible limbs only",
      () => {
        const body = bodyEntity( pose() );

        expect( body ).not.toBeNull();
        expect( entityDistance(
          body!,
          10,
          9
        ) ).toBeLessThan( 0 ); // torso
        expect( entityDistance(
          body!,
          10,
          2
        ) ).toBeLessThan( 0 ); // head
        expect( entityDistance(
          body!,
          6,
          7
        ) ).toBeLessThan( 0.4 ); // upper left arm
        // The right forearm needs a visible wrist: nothing at its midpoint.
        expect( entityDistance(
          body!,
          15.5,
          11
        ) ).toBeGreaterThan( 0.5 );
      }
    );

    it(
      "is null without both shoulders",
      () => {
        const pts = pose();

        pts[ 12 ].visibility = 0;
        expect( bodyEntity( pts ) ).toBeNull();
      }
    );
  }
);

describe(
  "cursorEntity",
  () => {
    it(
      "makes a disc, an oval or a hand of the asked size",
      () => {
        expect( entityDistance(
          cursorEntity(
            "disc",
            3,
            3,
            4
          ),
          3,
          3
        ) ).toBe( -2 );
        expect( cursorEntity(
          "oval",
          0,
          0,
          4
        ).prims.length ).toBe( 1 );

        const hand = cursorEntity(
          "hand",
          10,
          10,
          6
        );

        expect( hand.prims.length ).toBe( 6 );
        // The palm sits below the centre, the fingers above (toward -z).
        expect( entityDistance(
          hand,
          10,
          12
        ) ).toBeLessThan( 0 );
        expect( entityDistance(
          hand,
          10,
          8.5
        ) ).toBeLessThan( 0 );
        expect( entityDistance(
          hand,
          10,
          16
        ) ).toBeGreaterThan( 0 );
        expect( hand.maxZ - hand.minZ ).toBeLessThanOrEqual( 6.5 );
      }
    );
  }
);

describe(
  "processMask / maskPresenceAt",
  () => {
    const mask = ( fill: ( x: number, y: number ) => number ) => {
      const data = new Uint8Array( 64 );

      for ( let y = 0; y < 8; y++ ) {
        for ( let x = 0; x < 8; x++ ) {
          data[ y * 8 + x ] = fill(
            x,
            y
          );
        }
      }

      return {
        data,
        width: 8,
        height: 8
      };
    };

    it(
      "reads the subject's footprint and dilates it",
      () => {
        const block = mask( (
          x, y
        ) => ( x >= 3 && x <= 4 && y >= 3 && y <= 4 ? 15 : 0 ) );
        const raw = processMask( block );

        expect( raw!.count ).toBe( 4 );
        expect( raw!.cu ).toBeCloseTo(
          3.5 / 8,
          9
        );
        expect( raw!.cv ).toBeCloseTo(
          3.5 / 8,
          9
        );
        expect( raw!.data[ 3 * 8 + 3 ] ).toBe( 1 );
        expect( raw!.data[ 2 * 8 + 3 ] ).toBe( 0 );

        const dilated = processMask(
          block,
          {
            dilate: 1
          }
        );

        expect( dilated!.data[ 2 * 8 + 2 ] ).toBe( 1 );
        expect( dilated!.data[ 1 * 8 + 1 ] ).toBe( 0 );
      }
    );

    it(
      "blurs into a soft edge and samples bilinearly",
      () => {
        const block = mask( (
          x, y
        ) => ( x >= 2 && x <= 5 && y >= 2 && y <= 5 ? 1 : 0 ) );
        const soft = processMask(
          block,
          {
            blur: 1
          }
        );

        expect( soft!.data[ 3 * 8 + 3 ] ).toBeCloseTo(
          1,
          9
        );
        expect( soft!.data[ 1 * 8 + 3 ] ).toBeGreaterThan( 0 );
        expect( soft!.data[ 1 * 8 + 3 ] ).toBeLessThan( 1 );
        expect( maskPresenceAt(
          soft,
          3.5 / 7,
          3.5 / 7
        ) ).toBeCloseTo(
          1,
          6
        );
        expect( maskPresenceAt(
          soft,
          0,
          0
        ) ).toBe( 0 );
        expect( maskPresenceAt(
          null,
          0.5,
          0.5
        ) ).toBe( 0 );
      }
    );

    it(
      "is null for an empty result",
      () => {
        expect( processMask( null as any ) ).toBeNull();
      }
    );
  }
);
