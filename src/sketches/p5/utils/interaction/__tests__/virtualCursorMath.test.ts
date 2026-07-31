/**
 * Unit tests for the pure virtual-cursor state machine
 * (`virtualCursorMath.js`) behind the drawn cursor layer (virtualCursor.js).
 */
import {
  resolveCursorState,
  stepCursors,
  CURSOR_POINTING,
  CURSOR_OPEN,
  CURSOR_GRABBING
} from "../virtualCursorMath.js";

type Point = {
  x: number;
  y: number;
};

type CursorState = {
  positions: Map<string, Point>;
};

const freshState = (): CursorState => ( {
  positions: new Map()
} );

const pointer = (
  key: string,
  x: number,
  y: number,
  pressed = false,
  kind = "mouse"
) => ( {
  key,
  x,
  y,
  pressed,
  kind
} );

const TARGETS = [
  {
    x: 100,
    y: 100
  },
  {
    x: 300,
    y: 100
  }
];

describe(
  "resolveCursorState",
  () => {
    it(
      "points when the pointer is over nothing grabbable",
      () => {
        expect( resolveCursorState(
          pointer(
            "mouse",
            10,
            10
          ),
          new Map(),
          TARGETS,
          44
        ) ).toBe( CURSOR_POINTING );
      }
    );

    it(
      "opens when the pointer is within the pick-up radius of a target",
      () => {
        expect( resolveCursorState(
          pointer(
            "mouse",
            120,
            100
          ),
          new Map(),
          TARGETS,
          44
        ) ).toBe( CURSOR_OPEN );
      }
    );

    it(
      "stays pointing just outside the pick-up radius",
      () => {
        expect( resolveCursorState(
          pointer(
            "mouse",
            150,
            100
          ),
          new Map(),
          TARGETS,
          44
        ) ).toBe( CURSOR_POINTING );
      }
    );

    it(
      "grabs whenever the drag layer holds a target for that pointer, wherever it is",
      () => {
        const drags = new Map( [
          [
            "mouse",
            0
          ]
        ] );

        // Dragged far past every target: still a grab, because the drag layer
        // says so. The icon must follow the drag layer, not re-guess.
        expect( resolveCursorState(
          pointer(
            "mouse",
            600,
            600
          ),
          drags,
          TARGETS,
          44
        ) ).toBe( CURSOR_GRABBING );
      }
    );

    it(
      "treats a missing drag map as no drags",
      () => {
        expect( resolveCursorState(
          pointer(
            "mouse",
            100,
            100
          ),
          null,
          TARGETS,
          44
        ) ).toBe( CURSOR_OPEN );
      }
    );
  }
);

describe(
  "stepCursors",
  () => {
    it(
      "returns one cursor per pointer, unsmoothed by default",
      () => {
        const state = freshState();
        const cursors = stepCursors(
          state,
          [
            pointer(
              "mouse",
              10,
              20
            ),
            pointer(
              "touch-0",
              30,
              40,
              true,
              "touch"
            )
          ],
          {
            targets: TARGETS,
            radius: 44
          }
        );

        expect( cursors ).toHaveLength( 2 );
        expect( cursors[ 0 ] ).toMatchObject( {
          key: "mouse",
          kind: "mouse",
          x: 10,
          y: 20,
          state: CURSOR_POINTING
        } );
        expect( cursors[ 1 ] ).toMatchObject( {
          key: "touch-0",
          x: 30,
          y: 40
        } );
      }
    );

    it(
      "eases the drawn position toward the pointer when smoothing is on",
      () => {
        const state = freshState();
        const config = {
          targets: TARGETS,
          radius: 44,
          smoothing: 0.5
        };

        stepCursors(
          state,
          [
            pointer(
              "mouse",
              0,
              0
            )
          ],
          config
        );

        const [
          moved
        ] = stepCursors(
          state,
          [
            pointer(
              "mouse",
              100,
              0
            )
          ],
          config
        );

        // Halfway there after one frame, not teleported.
        expect( moved.x ).toBeCloseTo( 50 );

        const [
          again
        ] = stepCursors(
          state,
          [
            pointer(
              "mouse",
              100,
              0
            )
          ],
          config
        );

        expect( again.x ).toBeCloseTo( 75 );
      }
    );

    it(
      "resolves the state from the RAW pointer, not the smoothed position",
      () => {
        const state = freshState();
        const config = {
          targets: TARGETS,
          radius: 44,
          smoothing: 0.9
        };

        stepCursors(
          state,
          [
            pointer(
              "mouse",
              0,
              0
            )
          ],
          config
        );

        // The drawn cursor still lags near the origin, but the real pointer is
        // on the target — so the hand must already be open.
        const [
          cursor
        ] = stepCursors(
          state,
          [
            pointer(
              "mouse",
              100,
              100
            )
          ],
          config
        );

        expect( cursor.x ).toBeLessThan( 50 );
        expect( cursor.state ).toBe( CURSOR_OPEN );
      }
    );

    it(
      "forgets a pointer that vanished, so a returning key starts fresh",
      () => {
        const state = freshState();
        const config = {
          targets: TARGETS,
          radius: 44,
          smoothing: 0.5
        };

        stepCursors(
          state,
          [
            pointer(
              "mouse",
              0,
              0
            )
          ],
          config
        );
        stepCursors(
          state,
          [],
          config
        );

        expect( state.positions.size ).toBe( 0 );

        const [
          returned
        ] = stepCursors(
          state,
          [
            pointer(
              "mouse",
              100,
              0
            )
          ],
          config
        );

        // No stale anchor at 0 to ease out of: it snaps to where it reappeared.
        expect( returned.x ).toBeCloseTo( 100 );
      }
    );
  }
);
