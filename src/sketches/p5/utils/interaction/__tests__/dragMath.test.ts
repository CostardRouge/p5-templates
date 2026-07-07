/**
 * Unit tests for the pure drag state machine (`dragMath.js`) shared by the
 * on-canvas draggable layers (splines-v2-draggable, the content-item drag).
 */
import {
  nearestTargetIndex,
  stepDrag
} from "../dragMath.js";

type Pointer = {
  key: string;
  x: number;
  y: number;
  pressed: boolean;
  kind: string;
};

const pointer = (
  key: string,
  x: number,
  y: number,
  pressed: boolean,
  kind = "mouse"
): Pointer => ( {
  key,
  x,
  y,
  pressed,
  kind
} );

const targetsOf = ( ...coords: Array<[number, number]> ) =>
  coords.map( ( [
    x,
    y
  ] ) => ( {
    x,
    y
  } ) );

describe(
  "nearestTargetIndex",
  () => {
    const targets = targetsOf(
      [
        100,
        100
      ],
      [
        200,
        100
      ],
      [
        105,
        100
      ]
    );

    it(
      "returns the closest target within the radius",
      () => {
        expect( nearestTargetIndex(
          targets,
          104,
          100,
          44
        ) ).toBe( 2 );
      }
    );

    it(
      "returns -1 when nothing is within the radius",
      () => {
        expect( nearestTargetIndex(
          targets,
          500,
          500,
          44
        ) ).toBe( -1 );
      }
    );

    it(
      "skips indices already taken by another pointer",
      () => {
        expect( nearestTargetIndex(
          targets,
          104,
          100,
          44,
          new Set( [
            2
          ] )
        ) ).toBe( 0 );
      }
    );
  }
);

describe(
  "stepDrag",
  () => {
    it(
      "grabs the nearest free target on press and moves it",
      () => {
        const drags = new Map<string, number>();
        const targets = targetsOf( [
          100,
          100
        ] );
        const moves: Array<[number, Pointer]> = [];

        const result = stepDrag(
          drags,
          [
            pointer(
              "mouse",
              110,
              95,
              true
            )
          ],
          targets,
          44,
          (
            index: number, ptr: Pointer
          ) => moves.push( [
            index,
            ptr
          ] )
        );

        expect( drags.get( "mouse" ) ).toBe( 0 );
        expect( moves ).toEqual( [
          [
            0,
            expect.objectContaining( {
              x: 110,
              y: 95
            } )
          ]
        ] );
        expect( result.grabbed.has( 0 ) ).toBe( true );
        expect( result.released ).toBe( false );
      }
    );

    it(
      "does not grab targets outside the radius",
      () => {
        const drags = new Map<string, number>();

        const result = stepDrag(
          drags,
          [
            pointer(
              "mouse",
              300,
              300,
              true
            )
          ],
          targetsOf( [
            100,
            100
          ] ),
          44,
          () => {
            throw new Error( "should not move" );
          }
        );

        expect( drags.size ).toBe( 0 );
        expect( result.grabbed.size ).toBe( 0 );
      }
    );

    it(
      "keeps an in-flight drag glued to its pointer even far from the target",
      () => {
        const drags = new Map<string, number>( [
          [
            "mouse",
            0
          ]
        ] );
        const moves: number[] = [];

        stepDrag(
          drags,
          [
            pointer(
              "mouse",
              900,
              900,
              true
            )
          ],
          targetsOf( [
            100,
            100
          ] ),
          44,
          ( index: number ) => moves.push( index )
        );

        expect( drags.get( "mouse" ) ).toBe( 0 );
        expect( moves ).toEqual( [
          0
        ] );
      }
    );

    it(
      "releases when the pointer un-presses and reports it",
      () => {
        const drags = new Map<string, number>( [
          [
            "mouse",
            0
          ]
        ] );

        const result = stepDrag(
          drags,
          [
            pointer(
              "mouse",
              100,
              100,
              false
            )
          ],
          targetsOf( [
            100,
            100
          ] ),
          44,
          () => {
            throw new Error( "should not move" );
          }
        );

        expect( drags.size ).toBe( 0 );
        expect( result.released ).toBe( true );
      }
    );

    it(
      "releases when the pointer vanishes (finger lifted)",
      () => {
        const drags = new Map<string, number>( [
          [
            "touch-0",
            0
          ]
        ] );

        const result = stepDrag(
          drags,
          [],
          targetsOf( [
            100,
            100
          ] ),
          44,
          () => {
            throw new Error( "should not move" );
          }
        );

        expect( drags.size ).toBe( 0 );
        expect( result.released ).toBe( true );
      }
    );

    it(
      "releases when the grabbed target no longer exists (item removed)",
      () => {
        const drags = new Map<string, number>( [
          [
            "mouse",
            3
          ]
        ] );

        const result = stepDrag(
          drags,
          [
            pointer(
              "mouse",
              100,
              100,
              true
            )
          ],
          targetsOf( [
            100,
            100
          ] ),
          44,
          () => {
            // The pointer is free again — it may immediately re-grab target 0.
          }
        );

        expect( result.released ).toBe( true );
        expect( drags.get( "mouse" ) ).toBe( 0 );
      }
    );

    it(
      "lets several pointers drag different targets without fighting",
      () => {
        const drags = new Map<string, number>();
        const targets = targetsOf(
          [
            100,
            100
          ],
          [
            120,
            100
          ]
        );
        const moves: Array<[number, string]> = [];

        stepDrag(
          drags,
          [
            pointer(
              "touch-0",
              102,
              100,
              true,
              "touch"
            ),
            pointer(
              "touch-1",
              104,
              100,
              true,
              "touch"
            )
          ],
          targets,
          44,
          (
            index: number, ptr: Pointer
          ) => moves.push( [
            index,
            ptr.key
          ] )
        );

        // Both fingers are closest to target 0, but the second finger must
        // fall back to the free target 1.
        expect( drags.get( "touch-0" ) ).toBe( 0 );
        expect( drags.get( "touch-1" ) ).toBe( 1 );
        expect( moves ).toEqual( [
          [
            0,
            "touch-0"
          ],
          [
            1,
            "touch-1"
          ]
        ] );
      }
    );

    it(
      "hovers unpressed mouse/camera pointers but never touch",
      () => {
        const drags = new Map<string, number>();
        const targets = targetsOf( [
          100,
          100
        ] );

        const hovered = stepDrag(
          drags,
          [
            pointer(
              "mouse",
              105,
              100,
              false
            ),
            pointer(
              "cam-hand-0",
              104,
              100,
              false,
              "camera"
            )
          ],
          targets,
          44,
          () => {
            throw new Error( "should not move" );
          }
        );

        expect( hovered.hovers.has( 0 ) ).toBe( true );

        const touched = stepDrag(
          drags,
          [
            pointer(
              "touch-0",
              105,
              100,
              false,
              "touch"
            )
          ],
          targets,
          44,
          () => {
            throw new Error( "should not move" );
          }
        );

        expect( touched.hovers.size ).toBe( 0 );
      }
    );
  }
);
