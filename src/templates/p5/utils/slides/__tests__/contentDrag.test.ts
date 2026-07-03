/**
 * @jest-environment jsdom
 *
 * Integration tests for the content-item drag layer. These drive the REAL
 * capture-phase pointer flow through jsdom to lock in the behaviour that
 * matters: a press on an item must be claimed BEFORE the viewport's gesture
 * recogniser sees it (stopImmediatePropagation), the item must follow the
 * pointer, the move must persist on release, and a press that misses every
 * item must fall through untouched so the viewport can still pan.
 */

// ── Module mocks ────────────────────────────────────────────────────────────
// A fake p5: fixed 1000×1000 canvas buffer, always looping (so requestRedraw is
// a no-op), plus a real <canvas> element as the event target.
const canvasEl = ( () => {
  const el = document.createElement( "canvas" );

  el.className = "p5Canvas";
  // jsdom gives 0×0 rects by default; pin one so clientToCanvas isn't needed —
  // we mock clientToCanvas directly below instead.
  document.body.appendChild( el );

  return el;
} )();

const fakeP5 = {
  width: 1000,
  height: 1000,
  isLooping: () => true,
  redraw: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  noFill: jest.fn(),
  noStroke: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  strokeWeight: jest.fn(),
  circle: jest.fn()
};

jest.mock(
  "../../sketch.js",
  () => ( {
    __esModule: true,
    default: {
      getCanvasElement: () => canvasEl
    },
    getP5: () => fakeP5
  } )
);

// A mutable in-memory option store.
let store: Record<string, unknown> = {};
const setSketchOptions = jest.fn( ( update: Record<string, unknown> ) => {
  store = {
    ...store,
    ...update
  };
} );

jest.mock(
  "../../../shared/syncSketchOptions.js",
  () => ( {
    __esModule: true,
    getSketchOptions: () => store,
    setSketchOptions: ( ...args: unknown[] ) => setSketchOptions( ...args as [Record<string, unknown>] )
  } )
);

// Display scale 1 (canvas shown 1:1) and a direct client→canvas passthrough:
// the tests place pointers in canvas coordinates already.
jest.mock(
  "../../interaction/pointerTracking.js",
  () => ( {
    __esModule: true,
    getCanvasDisplayScale: () => 1,
    clientToCanvas: (
      x: number, y: number
    ) => ( {
      x,
      y
    } )
  } )
);

import {
  registerContentDrag
} from "../contentDrag.js";
import {
  beginItemBounds,
  reportItemBounds,
  endItemBounds
} from "../common/itemBoundsRegistry.js";

// window.getCurrentSlide is read to resolve the slide scope; no slides here.
( window as unknown as { getCurrentSlide?: () => unknown } ).getCurrentSlide = () => ( {
  index: 0
} );

// Dispatch a pointer event on the canvas and report whether propagation to the
// viewport (a bubble/capture listener further down the tree) was stopped. We
// approximate "the viewport sees it" with a window listener registered AFTER
// contentDrag's — stopImmediatePropagation on window-capture prevents it.
function pressAt(
  type: string, x: number, y: number, pointerId = 1
) {
  const event = new Event(
    type,
    {
      bubbles: true,
      cancelable: true
    }
  ) as PointerEvent & { pointerId: number };

  Object.assign(
    event,
    {
      clientX: x,
      clientY: y,
      pointerId,
      pointerType: "mouse",
      button: 0
    }
  );

  canvasEl.dispatchEvent( event );

  return event;
}

beforeEach( () => {
  store = {
    content: [
      {
        type: "text",
        content: "hello",
        position: {
          x: 0.5,
          y: 0.5
        },
        margin: {
          horizontal: 0,
          vertical: 0
        }
      }
    ]
  };
  setSketchOptions.mockClear();
  fakeP5.redraw.mockClear();
  registerContentDrag();
} );

describe(
  "content drag — pointer flow",
  () => {
    it(
      "claims a press that lands on an item (stops it reaching the viewport)",
      () => {
        // Item anchor is at (0.5,0.5)*1000 = (500,500).
        const down = pressAt(
          "pointerdown",
          500,
          500
        );

        // stopImmediatePropagation makes the event non-cancelable for later
        // listeners; the clearest observable is that defaultPrevented is set
        // (we called preventDefault) and no pan occurred.
        expect( down.defaultPrevented ).toBe( true );
      }
    );

    it(
      "does NOT claim a press that misses every item (viewport can pan)",
      () => {
        const down = pressAt(
          "pointerdown",
          50,
          50
        );

        expect( down.defaultPrevented ).toBe( false );
      }
    );

    it(
      "hides an on-item press from a later window listener (the viewport)",
      () => {
        // contentDrag registered its window-capture handler in beforeEach;
        // this stand-in for the viewport's recogniser registers AFTER, so
        // stopImmediatePropagation on the earlier handler must starve it.
        const viewport = jest.fn();

        window.addEventListener(
          "pointerdown",
          viewport,
          {
            capture: true
          }
        );

        try {
          pressAt(
            "pointerdown",
            500,
            500
          ); // on the item

          expect( viewport ).not.toHaveBeenCalled();

          pressAt(
            "pointerdown",
            50,
            50
          ); // empty canvas

          expect( viewport ).toHaveBeenCalledTimes( 1 );
        } finally {
          window.removeEventListener(
            "pointerdown",
            viewport,
            {
              capture: true
            }
          );
        }
      }
    );

    it(
      "moves the item and persists the new position on release",
      () => {
        pressAt(
          "pointerdown",
          500,
          500
        );
        pressAt(
          "pointermove",
          700,
          300
        );
        pressAt(
          "pointerup",
          700,
          300
        );

        expect( setSketchOptions ).toHaveBeenCalledTimes( 1 );

        const [
          update,
          origin
        ] = setSketchOptions.mock.calls[ 0 ] as [
          { content: Array<{ position: { x: number;
            y: number } }> },
          string
        ];

        expect( origin ).toBe( "p5" );
        expect( update.content[ 0 ].position.x ).toBeCloseTo( 0.7 );
        expect( update.content[ 0 ].position.y ).toBeCloseTo( 0.3 );
      }
    );

    it(
      "does not persist until release (no 60fps store writes)",
      () => {
        pressAt(
          "pointerdown",
          500,
          500
        );
        pressAt(
          "pointermove",
          600,
          400
        );

        expect( setSketchOptions ).not.toHaveBeenCalled();
      }
    );

    it(
      "ignores moves from a different pointer id mid-drag",
      () => {
        pressAt(
          "pointerdown",
          500,
          500,
          1
        );
        // Pointer 1 drives the drag to (0.6, 0.6)…
        pressAt(
          "pointermove",
          600,
          600,
          1
        );
        // …a second finger moving elsewhere must NOT steer it.
        pressAt(
          "pointermove",
          100,
          900,
          2
        );
        pressAt(
          "pointerup",
          600,
          600,
          1
        );

        const [
          update
        ] = setSketchOptions.mock.calls[ 0 ] as [
          { content: Array<{ position: { x: number;
            y: number } }> }
        ];

        // Held pointer 1's position, not pointer 2's (0.1, 0.9).
        expect( update.content[ 0 ].position.x ).toBeCloseTo( 0.6 );
        expect( update.content[ 0 ].position.y ).toBeCloseTo( 0.6 );
      }
    );
  }
);

describe(
  "content drag — visible-bounds grabbing",
  () => {
    it(
      "grabs by the drawn rectangle even when it is far from the anchor, and drags by offset",
      () => {
        // The renderer reports the item's VISIBLE rect at (700..900, 100..200)
        // while the anchor sits at (500, 500) — the palette-default text
        // situation (glyphs centred mid-canvas, anchor at the layout origin).
        beginItemBounds(
          "global",
          0
        );
        reportItemBounds(
          700,
          100,
          200,
          100
        );
        endItemBounds();

        // Press inside the visible rect (its centre), far from the anchor.
        const down = pressAt(
          "pointerdown",
          800,
          150
        );

        expect( down.defaultPrevented ).toBe( true );

        // Drag +100/+200; release.
        pressAt(
          "pointermove",
          900,
          350
        );
        pressAt(
          "pointerup",
          900,
          350
        );

        expect( setSketchOptions ).toHaveBeenCalledTimes( 1 );

        const [
          update
        ] = setSketchOptions.mock.calls[ 0 ] as [
          { content: Array<{ position: { x: number;
            y: number } }> }
        ];

        // Offset drag: the position moves by the pointer DELTA (+0.1, +0.2)
        // from its start (0.5, 0.5) — it does not snap the anchor under the
        // cursor.
        expect( update.content[ 0 ].position.x ).toBeCloseTo( 0.6 );
        expect( update.content[ 0 ].position.y ).toBeCloseTo( 0.7 );
      }
    );

    it(
      "does not fall back to the anchor disc when fresh bounds exist elsewhere",
      () => {
        beginItemBounds(
          "global",
          0
        );
        reportItemBounds(
          700,
          100,
          200,
          100
        );
        endItemBounds();

        // Press at the ANCHOR (500,500) — visibly empty, since the item is
        // drawn at its reported rect. Must fall through to the viewport pan.
        const down = pressAt(
          "pointerdown",
          500,
          500
        );

        expect( down.defaultPrevented ).toBe( false );
      }
    );
  }
);
