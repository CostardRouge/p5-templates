/**
 * Unit tests for the pure pinch state machine (`pinchMath.js`) behind the
 * multi-hand pinch layer (handPinch.js) used by the interactive braid.
 */
import {
  fingertipsOf,
  stepPinch
} from "../pinchMath.js";

type Point = {
  x: number;
  y: number;
};

type PinchState = {
  hands: Map<string, {
    thumb: Point;
    index: Point;
    mid: Point;
    pinching: boolean;
  }>;
  smooth: Map<string, Point>;
  latch: Map<string, boolean>;
};

const freshState = (): PinchState => ( {
  hands: new Map(),
  smooth: new Map(),
  latch: new Map()
} );

// A five-fingertip hand whose thumb/index tips are `gap` px apart around
// (x, y). The remaining tips just trail off to the side.
const hand = (
  id: string,
  x: number,
  y: number,
  gap: number
) => ( {
  id,
  points: [
    {
      x: x - gap / 2,
      y
    },
    {
      x: x + gap / 2,
      y
    },
    {
      x: x + 60,
      y
    },
    {
      x: x + 80,
      y
    },
    {
      x: x + 100,
      y
    }
  ]
} );

describe(
  "fingertipsOf",
  () => {
    it(
      "returns the trailing five's thumb and index (palm optional)",
      () => {
        const tips = [
          {
            x: 1,
            y: 0
          },
          {
            x: 2,
            y: 0
          },
          {
            x: 3,
            y: 0
          },
          {
            x: 4,
            y: 0
          },
          {
            x: 5,
            y: 0
          }
        ];

        expect( fingertipsOf( tips ) ).toEqual( {
          thumb: tips[ 0 ],
          index: tips[ 1 ]
        } );

        const withPalm = [
          {
            x: 0,
            y: 0
          },
          ...tips
        ];

        expect( fingertipsOf( withPalm ) ).toEqual( {
          thumb: tips[ 0 ],
          index: tips[ 1 ]
        } );
      }
    );

    it(
      "returns null for lists too short to be a hand",
      () => {
        expect( fingertipsOf( [
          {
            x: 0,
            y: 0
          }
        ] ) ).toBeNull();
        expect( fingertipsOf( undefined as never ) ).toBeNull();
      }
    );
  }
);

describe(
  "stepPinch",
  () => {
    it(
      "emits one pressed camera pointer per pinching hand",
      () => {
        const state = freshState();
        const pointers = stepPinch(
          state,
          [
            hand(
              "hand-0",
              100,
              100,
              20
            ),
            hand(
              "hand-1",
              300,
              100,
              200
            )
          ],
          {
            pinch: 70,
            smoothing: 0
          }
        );

        expect( pointers ).toHaveLength( 2 );
        expect( pointers[ 0 ] ).toMatchObject( {
          key: "cam-hand-0",
          x: 100,
          y: 100,
          pressed: true,
          kind: "camera"
        } );
        expect( pointers[ 1 ].pressed ).toBe( false );
      }
    );

    it(
      "latches with hysteresis: releases only past pinch × releaseRatio",
      () => {
        const state = freshState();
        const step = ( gap: number ) => stepPinch(
          state,
          [
            hand(
              "hand-0",
              100,
              100,
              gap
            )
          ],
          {
            pinch: 70,
            smoothing: 0,
            releaseRatio: 1.6
          }
        )[ 0 ].pressed;

        expect( step( 60 ) ).toBe( true );

        // Between the grab and release thresholds: an engaged pinch holds…
        expect( step( 100 ) ).toBe( true );

        // …but past release it lets go, and the same gap no longer re-grabs.
        expect( step( 120 ) ).toBe( false );
        expect( step( 100 ) ).toBe( false );
      }
    );

    it(
      "smooths the midpoint per hand without smoothing the latch",
      () => {
        const state = freshState();

        stepPinch(
          state,
          [
            hand(
              "hand-0",
              100,
              100,
              20
            )
          ],
          {
            smoothing: 0.5
          }
        );

        const [
          pointer
        ] = stepPinch(
          state,
          [
            hand(
              "hand-0",
              200,
              100,
              20
            )
          ],
          {
            smoothing: 0.5
          }
        );

        // EMA with lag 0.5 covers half the distance per step.
        expect( pointer.x ).toBeCloseTo( 150 );
        expect( pointer.pressed ).toBe( true );
      }
    );

    it(
      "prunes hands that left the frame",
      () => {
        const state = freshState();

        stepPinch(
          state,
          [
            hand(
              "hand-0",
              100,
              100,
              20
            ),
            hand(
              "hand-1",
              300,
              100,
              20
            )
          ]
        );

        expect( state.hands.size ).toBe( 2 );

        stepPinch(
          state,
          [
            hand(
              "hand-1",
              300,
              100,
              20
            )
          ]
        );

        expect( state.hands.size ).toBe( 1 );
        expect( state.smooth.has( "hand-0" ) ).toBe( false );
        expect( state.latch.has( "hand-0" ) ).toBe( false );
      }
    );

    it(
      "ignores groups too short to be hands",
      () => {
        const state = freshState();
        const pointers = stepPinch(
          state,
          [
            {
              id: "orbit-0",
              points: [
                {
                  x: 10,
                  y: 10
                }
              ]
            }
          ]
        );

        expect( pointers ).toHaveLength( 0 );
        expect( state.hands.size ).toBe( 0 );
      }
    );
  }
);
