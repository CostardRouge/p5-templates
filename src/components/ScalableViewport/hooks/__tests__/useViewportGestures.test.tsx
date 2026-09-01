/**
 * @jest-environment jsdom
 */
import {
  act, renderHook
} from "@testing-library/react";
import {
  useRef
} from "react";
import type {
  TransformState
} from "../useTransformState";
import {
  useViewportGestures
} from "../useViewportGestures";

// Wheel events on the viewport container: a plain one is a two-finger
// trackpad scroll (or a mouse wheel) and must pan; a ctrl-modified one is
// what browsers synthesise for a trackpad pinch and belongs to the pinch
// recogniser, so the wheel handler must not touch the transform for it.

function mountGestures() {
  const container = document.createElement( "div" );

  document.body.appendChild( container );

  const transform: TransformState = {
    x: 100,
    y: 50,
    scale: 1
  };
  const setTransform = jest.fn( ( values: Partial<TransformState> ) => Object.assign(
    transform,
    values
  ) );
  const onInteractionStart = jest.fn();
  const onInteractionEnd = jest.fn();
  const cancelAnimation = jest.fn();

  const hook = renderHook( () => {
    const containerRef = useRef<HTMLDivElement | null>( container );
    const contentRef = useRef<HTMLDivElement | null>( null );
    const transformRef = useRef( transform );

    useViewportGestures( {
      containerRef,
      contentRef,
      transform: transformRef,
      setTransform,
      cancelAnimation,
      onInteractionStart,
      onInteractionEnd
    } );
  } );

  const wheel = ( init: WheelEventInit ) => act( () => {
    container.dispatchEvent( new WheelEvent(
      "wheel",
      {
        bubbles: true,
        cancelable: true,
        ...init
      }
    ) );
  } );

  return {
    container,
    transform,
    setTransform,
    onInteractionStart,
    onInteractionEnd,
    cancelAnimation,
    wheel,
    unmount: () => {
      hook.unmount();
      container.remove();
    }
  };
}

describe(
  "useViewportGestures — wheel",
  () => {
    beforeEach( () => {
      jest.useFakeTimers();
    } );

    afterEach( () => {
      jest.useRealTimers();
    } );

    it(
      "pans on a plain wheel event, following the scroll direction",
      () => {
        const g = mountGestures();

        g.wheel( {
          deltaX: 10,
          deltaY: -20
        } );

        expect( g.setTransform ).toHaveBeenCalledTimes( 1 );
        expect( g.setTransform.mock.calls[ 0 ][ 0 ] ).toEqual( {
          x: 90,
          y: 70
        } );
        expect( g.transform.scale ).toBe( 1 );

        g.unmount();
      }
    );

    it(
      "opens a single panning interaction per scroll and closes it when the wheel settles",
      () => {
        const g = mountGestures();

        g.wheel( {
          deltaY: 5
        } );
        g.wheel( {
          deltaY: 5
        } );

        expect( g.cancelAnimation ).toHaveBeenCalledTimes( 1 );
        expect( g.onInteractionStart ).toHaveBeenCalledTimes( 1 );
        expect( g.onInteractionStart ).toHaveBeenCalledWith( "panning" );
        expect( g.onInteractionEnd ).not.toHaveBeenCalled();

        act( () => {
          jest.runOnlyPendingTimers();
        } );

        expect( g.onInteractionEnd ).toHaveBeenCalledTimes( 1 );

        g.unmount();
      }
    );

    it(
      "leaves a ctrl+wheel (trackpad pinch) to the pinch recogniser, which zooms",
      () => {
        const g = mountGestures();

        // Two events: the pinch handler only records its memo on the first one.
        g.wheel( {
          deltaY: -50,
          ctrlKey: true
        } );
        g.wheel( {
          deltaY: -50,
          ctrlKey: true
        } );

        // Every transform write came from the pinch handler: the scale moved and
        // nothing wrote a scale-less pan.
        expect( g.setTransform ).toHaveBeenCalled();
        expect( g.setTransform.mock.calls.every( ( [
          values
        ] ) => "scale" in values ) ).toBe( true );
        expect( g.transform.scale ).toBeGreaterThan( 1 );

        expect( g.onInteractionStart ).toHaveBeenCalledWith( "zooming" );
        expect( g.onInteractionStart ).not.toHaveBeenCalledWith( "panning" );

        act( () => {
          jest.runOnlyPendingTimers();
        } );

        // One end for the pinch; the wheel recogniser's own end is silent since
        // it never opened a pan.
        expect( g.onInteractionEnd ).toHaveBeenCalledTimes( 1 );

        g.unmount();
      }
    );
  }
);
