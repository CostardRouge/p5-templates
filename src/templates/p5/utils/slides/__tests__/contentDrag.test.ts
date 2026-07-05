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
  noLoop: jest.fn(),
  loop: jest.fn(),
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
  reportItemPartBounds,
  endItemBounds
} from "../common/itemBoundsRegistry.js";
import {
  pauseLoop, resumeLoop
} from "../../loopControl.js";

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

// Dispatch a hover-only pointermove, optionally on an element other than the
// canvas (to simulate the pointer leaving it).
function moveAt(
  x: number, y: number, target: Element = canvasEl
) {
  const event = new Event(
    "pointermove",
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
      pointerId: 1,
      pointerType: "mouse",
      button: 0
    }
  );

  target.dispatchEvent( event );

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

describe(
  "content drag — HUD sub-item widgets",
  () => {
    // A HUD item has no position of its own; each widget carries its own
    // `offset`. Dragging one widget must move ONLY that widget's offset.
    beforeEach( () => {
      store = {
        content: [
          {
            type: "hud",
            badge: {
              enabled: true,
              offset: {
                x: 0.9,
                y: 0.1
              }
            },
            gauge: {
              enabled: true,
              offset: {
                x: 0.1,
                y: 0.9
              }
            }
          }
        ]
      };
      setSketchOptions.mockClear();
      registerContentDrag();
    } );

    // Report each enabled widget's drawn rectangle for this frame, the way the
    // real widget renderers do inside freeLayout's bounds bracket.
    function reportHudBounds() {
      beginItemBounds(
        "global",
        0
      );
      // badge drawn top-right, gauge drawn bottom-left — well separated.
      reportItemPartBounds(
        "badge",
        800,
        80,
        150,
        30
      );
      reportItemPartBounds(
        "gauge",
        60,
        820,
        200,
        60
      );
      endItemBounds();
    }

    it(
      "grabs a HUD widget by its drawn rectangle and persists its offset",
      () => {
        reportHudBounds();

        // Press inside the badge rect, drag +100/+50, release.
        const down = pressAt(
          "pointerdown",
          850,
          95
        );

        expect( down.defaultPrevented ).toBe( true );

        pressAt(
          "pointermove",
          950,
          145
        );
        pressAt(
          "pointerup",
          950,
          145
        );

        expect( setSketchOptions ).toHaveBeenCalledTimes( 1 );

        const [
          update
        ] = setSketchOptions.mock.calls[ 0 ] as [
          { content: Array<{
            badge: { offset: { x: number;
              y: number } };
            gauge: { offset: { x: number;
              y: number } };
          }> }
        ];

        // Badge moved by the pointer delta (+0.1, +0.05) from (0.9, 0.1).
        expect( update.content[ 0 ].badge.offset.x ).toBeCloseTo( 1 );
        expect( update.content[ 0 ].badge.offset.y ).toBeCloseTo( 0.15 );
        // The gauge (a sibling widget) is untouched.
        expect( update.content[ 0 ].gauge.offset.x ).toBeCloseTo( 0.1 );
        expect( update.content[ 0 ].gauge.offset.y ).toBeCloseTo( 0.9 );
      }
    );

    it(
      "moves only the pressed widget when two widgets are enabled",
      () => {
        reportHudBounds();

        // Press inside the gauge rect this time.
        pressAt(
          "pointerdown",
          120,
          850
        );
        pressAt(
          "pointermove",
          220,
          850
        );
        pressAt(
          "pointerup",
          220,
          850
        );

        const [
          update
        ] = setSketchOptions.mock.calls[ 0 ] as [
          { content: Array<{
            badge: { offset: { x: number;
              y: number } };
            gauge: { offset: { x: number;
              y: number } };
          }> }
        ];

        // Gauge moved +0.1 on x; badge stayed put.
        expect( update.content[ 0 ].gauge.offset.x ).toBeCloseTo( 0.2 );
        expect( update.content[ 0 ].badge.offset.x ).toBeCloseTo( 0.9 );
        expect( update.content[ 0 ].badge.offset.y ).toBeCloseTo( 0.1 );
      }
    );

    it(
      "does not target a disabled widget",
      () => {
        store = {
          content: [
            {
              type: "hud",
              badge: {
                enabled: false,
                offset: {
                  x: 0.9,
                  y: 0.1
                }
              }
            }
          ]
        };
        registerContentDrag();

        // No bounds reported (disabled widget isn't drawn); a press on empty
        // canvas must fall through so the viewport can still pan.
        const down = pressAt(
          "pointerdown",
          850,
          95
        );

        expect( down.defaultPrevented ).toBe( false );
      }
    );
  }
);

describe(
  "content drag — hover redraw respects pause",
  () => {
    afterEach( () => {
      fakeP5.isLooping = () => true;
      resumeLoop( fakeP5 );
    } );

    it(
      "redraws on hover-target change for a static (non-looping) sketch",
      () => {
        fakeP5.isLooping = () => false;

        moveAt(
          500,
          500
        ); // onto the item

        expect( fakeP5.redraw ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "does not redraw on a hover-target change while explicitly paused",
      () => {
        fakeP5.isLooping = () => false;

        moveAt(
          500,
          500
        ); // hover onto the item first, while unpaused
        fakeP5.redraw.mockClear();

        pauseLoop( fakeP5 );

        moveAt(
          50,
          50
        ); // hover off the item — key changes to null

        expect( fakeP5.redraw ).not.toHaveBeenCalled();
      }
    );

    it(
      "does not redraw on mouse-leave while explicitly paused",
      () => {
        fakeP5.isLooping = () => false;

        moveAt(
          500,
          500
        ); // hover onto the item, so hoverPoint is set
        fakeP5.redraw.mockClear();

        pauseLoop( fakeP5 );

        moveAt(
          0,
          0,
          document.body
        ); // pointer leaves the canvas element

        expect( fakeP5.redraw ).not.toHaveBeenCalled();
      }
    );

    it(
      "resumes redrawing on hover changes once unpaused",
      () => {
        fakeP5.isLooping = () => false;

        moveAt(
          500,
          500
        );
        fakeP5.redraw.mockClear();

        pauseLoop( fakeP5 );
        moveAt(
          50,
          50
        );
        expect( fakeP5.redraw ).not.toHaveBeenCalled();

        resumeLoop( fakeP5 );

        moveAt(
          500,
          500
        ); // hover back onto the item — key changes again

        expect( fakeP5.redraw ).toHaveBeenCalledTimes( 1 );
      }
    );
  }
);
