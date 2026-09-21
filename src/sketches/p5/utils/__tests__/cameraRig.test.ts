/**
 * The tangible camera: every claim a sketch makes about it (a top view at
 * tilt 90, an export framed by `fit`, a loop that closes with motion on, an
 * offset that never loses the subject, a pointer ray that matches the shader)
 * is a property of the maths here, so it is checked here, without a canvas.
 */

import {
  cameraBasis,
  cameraFormValues,
  fitDistance,
  focalFromFov,
  hitPlaneY,
  screenRay
} from "../cameraRig.js";

type Vec = number[];

function dot(
  a: Vec, b: Vec
): number {
  return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
}

function length( v: Vec ): number {
  return Math.hypot(
    v[ 0 ],
    v[ 1 ],
    v[ 2 ]
  );
}

function expectClose(
  a: Vec, b: Vec, digits = 6
) {
  expect( a[ 0 ] ).toBeCloseTo(
    b[ 0 ],
    digits
  );
  expect( a[ 1 ] ).toBeCloseTo(
    b[ 1 ],
    digits
  );
  expect( a[ 2 ] ).toBeCloseTo(
    b[ 2 ],
    digits
  );
}

function camera( overrides: Record<string, unknown> = {} ) {
  return {
    ...structuredClone( cameraFormValues ),
    ...overrides
  };
}

describe(
  "cameraBasis",
  () => {
    it(
      "is an orthonormal, right-handed basis aimed at the target",
      () => {
        const basis = cameraBasis(
          camera( {
            tilt: 40,
            spin: 30,
            roll: 15
          } ),
          {
            radius: 1.3,
            aspect: 0.8,
            progression: 0.37
          }
        );

        expect( length( basis.fwd ) ).toBeCloseTo(
          1,
          9
        );
        expect( length( basis.right ) ).toBeCloseTo(
          1,
          9
        );
        expect( length( basis.up ) ).toBeCloseTo(
          1,
          9
        );
        expect( dot(
          basis.fwd,
          basis.right
        ) ).toBeCloseTo(
          0,
          9
        );
        expect( dot(
          basis.fwd,
          basis.up
        ) ).toBeCloseTo(
          0,
          9
        );
        expect( dot(
          basis.right,
          basis.up
        ) ).toBeCloseTo(
          0,
          9
        );

        // fwd points from the eye at the target.
        const toTarget = [
          basis.target[ 0 ] - basis.ro[ 0 ],
          basis.target[ 1 ] - basis.ro[ 1 ],
          basis.target[ 2 ] - basis.ro[ 2 ]
        ];

        expect( dot(
          toTarget,
          basis.fwd
        ) ).toBeCloseTo(
          length( toTarget ),
          9
        );
      }
    );

    it(
      "at tilt 90 is a top view: looking straight down, +x to the right, far side up",
      () => {
        const basis = cameraBasis(
          camera( {
            tilt: 90,
            fit: false,
            distance: 5
          } ),
          {
            aspect: 1
          }
        );

        // The tilt is clamped a tenth of a degree short of vertical, so the
        // basis is a top view to within sin( 0.1° ) ≈ 0.0017.
        expectClose(
          basis.fwd,
          [
            0,
            -1,
            0
          ],
          2
        );
        expectClose(
          basis.right,
          [
            1,
            0,
            0
          ],
          2
        );
        // Screen up is world +z: the side away from where spin 0 puts the eye.
        expectClose(
          basis.up,
          [
            0,
            0,
            1
          ],
          2
        );
        expect( basis.ro[ 1 ] ).toBeCloseTo(
          5,
          3
        );
      }
    );

    it(
      "spin 0 puts the eye on the -z side with +x to the right, like the braid orbit camera",
      () => {
        const basis = cameraBasis(
          camera( {
            tilt: 30,
            fit: false,
            distance: 2
          } ),
          {
            aspect: 1
          }
        );

        expect( basis.ro[ 2 ] ).toBeLessThan( 0 );
        expect( basis.right[ 0 ] ).toBeCloseTo(
          1,
          6
        );
        expect( basis.up[ 1 ] ).toBeGreaterThan( 0 );
      }
    );

    it(
      "fits the subject: the distance frames the bounding sphere on the tighter axis",
      () => {
        const focal = focalFromFov( 40 );

        // Portrait: the height is the tight axis.
        expect( fitDistance(
          1.5,
          focal,
          0.8
        ) ).toBeCloseTo(
          ( 2 * 1.5 * focal ) / 0.8,
          9
        );
        // Landscape: the width is wider than the height, so the height rules.
        expect( fitDistance(
          1.5,
          focal,
          1.7
        ) ).toBeCloseTo(
          2 * 1.5 * focal,
          9
        );

        const framed = cameraBasis(
          camera( {
            tilt: 90,
            fov: 40
          } ),
          {
            radius: 1.5,
            aspect: 0.8
          }
        );

        expect( framed.distance ).toBeCloseTo(
          fitDistance(
            1.5,
            focal,
            0.8
          ),
          9
        );

        // With fit on, `distance` multiplies the framed distance.
        const pushed = cameraBasis(
          camera( {
            tilt: 90,
            fov: 40,
            distance: 0.5
          } ),
          {
            radius: 1.5,
            aspect: 0.8
          }
        );

        expect( pushed.distance ).toBeCloseTo(
          framed.distance / 2,
          9
        );
      }
    );

    it(
      "closes the loop: every motion is whole cycles, so progression 0 and 1 agree",
      () => {
        const moving = camera( {
          motion: {
            spinTurns: 1.4, // rounds to 1
            tiltSway: 20,
            tiltCycles: 3,
            dolly: 0.3,
            dollyCycles: 2,
            bob: 0.5,
            bobCycles: 1
          }
        } );
        const scene = {
          radius: 1.2,
          aspect: 1.2
        };
        const start = cameraBasis(
          moving,
          {
            ...scene,
            progression: 0
          }
        );
        const end = cameraBasis(
          moving,
          {
            ...scene,
            progression: 1
          }
        );
        const middle = cameraBasis(
          moving,
          {
            ...scene,
            progression: 0.31
          }
        );

        expectClose(
          start.ro,
          end.ro,
          6
        );
        expectClose(
          start.fwd,
          end.fwd,
          6
        );
        expectClose(
          start.up,
          end.up,
          6
        );
        // …and the motion is real, not a no-op.
        expect( length( [
          start.ro[ 0 ] - middle.ro[ 0 ],
          start.ro[ 1 ] - middle.ro[ 1 ],
          start.ro[ 2 ] - middle.ro[ 2 ]
        ] ) ).toBeGreaterThan( 0.1 );
      }
    );

    it(
      "an eye offset moves the viewpoint but keeps aiming at the target",
      () => {
        const still = cameraBasis(
          camera( {
            tilt: 50
          } ),
          {
            radius: 1
          }
        );
        const shifted = cameraBasis(
          camera( {
            tilt: 50,
            position: {
              x: 1.5,
              y: 0.2,
              z: -0.4
            }
          } ),
          {
            radius: 1
          }
        );

        expectClose(
          [
            shifted.ro[ 0 ] - still.ro[ 0 ],
            shifted.ro[ 1 ] - still.ro[ 1 ],
            shifted.ro[ 2 ] - still.ro[ 2 ]
          ],
          [
            1.5,
            0.2,
            -0.4
          ],
          9
        );

        const toTarget = [
          shifted.target[ 0 ] - shifted.ro[ 0 ],
          shifted.target[ 1 ] - shifted.ro[ 1 ],
          shifted.target[ 2 ] - shifted.ro[ 2 ]
        ];

        expect( dot(
          toTarget,
          shifted.fwd
        ) ).toBeCloseTo(
          length( toTarget ),
          9
        );
      }
    );

    it(
      "roll turns the picture: a quarter turn swaps right and up",
      () => {
        const flat = cameraBasis( camera( {
          tilt: 45
        } ) );
        const rolled = cameraBasis( camera( {
          tilt: 45,
          roll: 90
        } ) );

        expectClose(
          rolled.right,
          flat.up,
          6
        );
        expectClose(
          rolled.up,
          [
            -flat.right[ 0 ],
            -flat.right[ 1 ],
            -flat.right[ 2 ]
          ],
          6
        );
        expectClose(
          rolled.fwd,
          flat.fwd,
          9
        );
      }
    );
  }
);

describe(
  "screenRay / hitPlaneY",
  () => {
    it(
      "the centre pixel looks along fwd, the right edge leans toward right, the top toward up",
      () => {
        const basis = cameraBasis( camera( {
          tilt: 50,
          spin: 20
        } ) );
        const centre = screenRay(
          basis,
          540,
          675,
          1080,
          1350
        );
        const rightEdge = screenRay(
          basis,
          1080,
          675,
          1080,
          1350
        );
        const topEdge = screenRay(
          basis,
          540,
          0,
          1080,
          1350
        );

        expectClose(
          centre,
          basis.fwd,
          9
        );
        expect( dot(
          rightEdge,
          basis.right
        ) ).toBeGreaterThan( 0 );
        expect( dot(
          topEdge,
          basis.up
        ) ).toBeGreaterThan( 0 );
      }
    );

    it(
      "drops the centre pixel of a fitted top view onto the target's plane point",
      () => {
        const basis = cameraBasis(
          camera( {
            tilt: 90,
            lookAt: {
              x: 0.3,
              y: 0,
              z: -0.2
            }
          } ),
          {
            radius: 1,
            aspect: 0.8
          }
        );
        const hit = hitPlaneY(
          basis,
          screenRay(
            basis,
            400,
            500,
            800,
            1000
          ),
          0
        );

        expect( hit ).not.toBeNull();
        expectClose(
          hit as number[],
          [
            0.3,
            0,
            -0.2
          ],
          3
        );
      }
    );

    it(
      "returns null for a ray that never reaches the plane",
      () => {
        const basis = cameraBasis( camera( {
          tilt: 10,
          fit: false,
          distance: 3
        } ) );

        // Looking up from the plane, slightly: the top edge of a low camera.
        const upward = screenRay(
          basis,
          540,
          -4000,
          1080,
          1350
        );

        expect( hitPlaneY(
          basis,
          upward,
          0
        ) ).toBeNull();
      }
    );
  }
);
