/**
 * @jest-environment jsdom
 */

import {
  act, renderHook
} from "@testing-library/react";
import type {
  PointerEvent as ReactPointerEvent
} from "react";

import useDragSlider from "../useDragSlider";

// The bar spans x = 0…100, so a clientX maps 1:1 to a percentage of the range.
const BAR_WIDTH = 100;

type PointerInit = {
  type?: string;
  pointerId?: number;
  pointerType?: string;
  clientX?: number;
  clientY?: number;
};

const pointerEvent = ( init: PointerInit = {} ) =>
  ( {
    type: "pointermove",
    pointerId: 1,
    pointerType: "mouse",
    clientX: 0,
    clientY: 0,
    ...init
  } as unknown as ReactPointerEvent<HTMLDivElement> );

const keyEvent = ( key: string ) =>
  ( {
    key,
    preventDefault: jest.fn()
  } as unknown as React.KeyboardEvent<HTMLDivElement> );

function createBar(): HTMLDivElement {
  const element = document.createElement( "div" );

  element.getBoundingClientRect = () =>
    ( {
      left: 0,
      top: 0,
      width: BAR_WIDTH,
      height: 20
    } as DOMRect );
  element.setPointerCapture = jest.fn();
  element.releasePointerCapture = jest.fn();
  element.hasPointerCapture = jest.fn( () => true );

  return element;
}

describe(
  "useDragSlider",
  () => {
    let scheduled: Map<number, FrameRequestCallback>;
    let nextFrameId: number;

    // Deterministic frames: the hook batches drag updates through rAF, so the
    // tests decide when a frame runs.
    const runFrames = () => {
      const callbacks = [
        ...scheduled.values()
      ];

      scheduled.clear();

      act( () => {
        callbacks.forEach( ( callback ) => callback( 0 ) );
      } );
    };

    const setup = ( value = 0 ) => {
      const onChange = jest.fn();
      const bar = createBar();
      const view = renderHook(
        ( props: { value: number } ) =>
          useDragSlider( {
            min: 0,
            max: 100,
            step: 1,
            value: props.value,
            onChange
          } ),
        {
          initialProps: {
            value
          }
        }
      );

      view.result.current.ref.current = bar;

      const fire = (
        handler: "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel",
        init: PointerInit = {}
      ) => {
        act( () => {
          view.result.current.handlers[ handler ]( pointerEvent( {
            type:
              handler === "onPointerUp"
                ? "pointerup"
                : handler === "onPointerCancel"
                  ? "pointercancel"
                  : "pointermove",
            ...init
          } ) );
        } );
      };

      return {
        onChange,
        bar,
        view,
        fire
      };
    };

    beforeEach( () => {
      scheduled = new Map();
      nextFrameId = 1;

      jest
        .spyOn(
          window,
          "requestAnimationFrame"
        )
        .mockImplementation( ( callback: FrameRequestCallback ) => {
          const id = nextFrameId++;

          scheduled.set(
            id,
            callback
          );

          return id;
        } );

      jest
        .spyOn(
          window,
          "cancelAnimationFrame"
        )
        .mockImplementation( ( id: number ) => {
          scheduled.delete( id );
        } );
    } );

    afterEach( () => {
      jest.restoreAllMocks();
    } );

    it(
      "commits the press point immediately for mouse input",
      () => {
        const {
          onChange, fire
        } = setup();

        fire(
          "onPointerDown",
          {
            clientX: 30
          }
        );

        expect( onChange ).toHaveBeenCalledTimes( 1 );
        expect( onChange ).toHaveBeenCalledWith( 30 );
      }
    );

    it(
      "coalesces a burst of moves into one change per frame",
      () => {
        const {
          onChange, fire
        } = setup();

        fire(
          "onPointerDown",
          {
            clientX: 10
          }
        );
        onChange.mockClear();

        [
          20,
          30,
          40,
          50
        ].forEach( ( clientX ) => fire(
          "onPointerMove",
          {
            clientX
          }
        ) );

        // Nothing is emitted from the event handlers themselves.
        expect( onChange ).not.toHaveBeenCalled();

        runFrames();

        expect( onChange ).toHaveBeenCalledTimes( 1 );
        expect( onChange ).toHaveBeenCalledWith( 50 );
      }
    );

    it(
      "skips moves that land on the value the bar already holds",
      () => {
        const {
          onChange, fire
        } = setup();

        fire(
          "onPointerDown",
          {
            clientX: 30
          }
        );
        onChange.mockClear();

        // Both round to 30 with step 1 — sub-step jitter must not emit.
        fire(
          "onPointerMove",
          {
            clientX: 30.2
          }
        );
        runFrames();
        fire(
          "onPointerMove",
          {
            clientX: 29.8
          }
        );
        runFrames();

        expect( onChange ).not.toHaveBeenCalled();
      }
    );

    it(
      "flushes the trailing move on pointer up when its frame hasn't run",
      () => {
        const {
          onChange, fire
        } = setup();

        fire(
          "onPointerDown",
          {
            clientX: 10
          }
        );
        onChange.mockClear();

        fire(
          "onPointerMove",
          {
            clientX: 80
          }
        );
        fire(
          "onPointerUp",
          {
            clientX: 80
          }
        );

        expect( onChange ).toHaveBeenCalledTimes( 1 );
        expect( onChange ).toHaveBeenCalledWith( 80 );

        // The cancelled frame must not replay the same value.
        runFrames();
        expect( onChange ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "leaves a vertical touch gesture to the scrolling panel",
      () => {
        const {
          onChange, fire, bar
        } = setup();

        fire(
          "onPointerDown",
          {
            pointerType: "touch",
            clientX: 50,
            clientY: 50
          }
        );

        expect( onChange ).not.toHaveBeenCalled();

        fire(
          "onPointerMove",
          {
            pointerType: "touch",
            clientX: 51,
            clientY: 70
          }
        );
        fire(
          "onPointerMove",
          {
            pointerType: "touch",
            clientX: 52,
            clientY: 90
          }
        );
        runFrames();

        expect( onChange ).not.toHaveBeenCalled();
        expect( bar.setPointerCapture ).not.toHaveBeenCalled();
      }
    );

    it(
      "adjusts the value once a touch gesture locks horizontally",
      () => {
        const {
          onChange, fire, bar
        } = setup();

        fire(
          "onPointerDown",
          {
            pointerType: "touch",
            clientX: 50,
            clientY: 50
          }
        );
        fire(
          "onPointerMove",
          {
            pointerType: "touch",
            clientX: 70,
            clientY: 52
          }
        );

        expect( bar.setPointerCapture ).toHaveBeenCalledWith( 1 );
        expect( onChange ).not.toHaveBeenCalled();

        runFrames();

        expect( onChange ).toHaveBeenCalledTimes( 1 );
        expect( onChange ).toHaveBeenCalledWith( 70 );
      }
    );

    it(
      "sets the value on a touch tap that never picked a direction",
      () => {
        const {
          onChange, fire
        } = setup();

        fire(
          "onPointerDown",
          {
            pointerType: "touch",
            clientX: 42,
            clientY: 50
          }
        );
        fire(
          "onPointerUp",
          {
            pointerType: "touch",
            clientX: 42,
            clientY: 50
          }
        );

        expect( onChange ).toHaveBeenCalledTimes( 1 );
        expect( onChange ).toHaveBeenCalledWith( 42 );
      }
    );

    it(
      "keeps keyboard stepping immediate",
      () => {
        const {
          onChange, view
        } = setup( 10 );

        act( () => {
          view.result.current.handlers.onKeyDown( keyEvent( "ArrowRight" ) );
        } );

        expect( onChange ).toHaveBeenCalledWith( 11 );
      }
    );
  }
);
