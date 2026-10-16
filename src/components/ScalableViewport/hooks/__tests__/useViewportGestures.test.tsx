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
  isMouseWheelEvent,
  useViewportGestures
} from "../useViewportGestures";

// Wheel events on the viewport container: a mouse wheel zooms about the
// cursor, a two-finger trackpad scroll pans, and a ctrl-modified one is what
// browsers synthesise for a trackpad pinch and belongs to the pinch
// recogniser, so the wheel handler must not touch the transform for it.

type WheelInit = WheelEventInit & { wheelDeltaY?: number };

// jsdom's WheelEvent has no legacy `wheelDeltaY`; Chromium and WebKit do.
function wheelEvent( {
  wheelDeltaY, ...init
}: WheelInit ): WheelEvent {
  const event = new WheelEvent(
    "wheel",
    {
      bubbles: true,
      cancelable: true,
      ...init
    }
  );

  if ( wheelDeltaY !== undefined ) {
    Object.defineProperty(
      event,
      "wheelDeltaY",
      {
        value: wheelDeltaY
      }
    );
  }

  return event;
}

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

  const wheel = ( init: WheelInit ) => act( () => {
    container.dispatchEvent( wheelEvent( init ) );
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

    it(
      "zooms on a mouse wheel, keeping the point under the cursor in place",
      () => {
        const g = mountGestures();
        // The content point under the cursor before the zoom.
        const clientX = 300;
        const clientY = 200;
        const under = ( t: TransformState ) => [
          ( clientX - t.x ) / t.scale,
          ( clientY - t.y ) / t.scale
        ];
        const before = under( {
          ...g.transform
        } );

        // A Chromium mouse notch: 100 px, legacy delta −120.
        g.wheel( {
          deltaY: -100,
          wheelDeltaY: 120,
          clientX,
          clientY
        } );

        expect( g.transform.scale ).toBeCloseTo( Math.exp( 1 ) );
        expect( under( g.transform )[ 0 ] ).toBeCloseTo( before[ 0 ] );
        expect( under( g.transform )[ 1 ] ).toBeCloseTo( before[ 1 ] );
        expect( g.onInteractionStart ).toHaveBeenCalledWith( "zooming" );
        expect( g.onInteractionStart ).not.toHaveBeenCalledWith( "panning" );

        g.unmount();
      }
    );

    it(
      "zooms out on a wheel turned toward the user, in lines as Firefox reports it",
      () => {
        const g = mountGestures();

        g.wheel( {
          deltaY: 3,
          deltaMode: 1
        } );

        expect( g.transform.scale ).toBeLessThan( 1 );

        g.unmount();
      }
    );

    it(
      "pans on a trackpad scroll, whose legacy delta is −3 × its pixel delta",
      () => {
        const g = mountGestures();

        g.wheel( {
          deltaY: 40,
          wheelDeltaY: -120
        } );

        expect( g.transform.scale ).toBe( 1 );
        expect( g.transform.y ).toBe( 10 );
        expect( g.onInteractionStart ).toHaveBeenCalledWith( "panning" );

        g.unmount();
      }
    );

    it(
      "keeps one mode for a whole burst, and decides again for the next",
      () => {
        const g = mountGestures();

        // A trackpad scroll, then an event that alone would read as a wheel.
        g.wheel( {
          deltaY: 4,
          wheelDeltaY: -12
        } );
        g.wheel( {
          deltaY: 100,
          wheelDeltaY: -120
        } );

        expect( g.transform.scale ).toBe( 1 );
        expect( g.onInteractionStart ).toHaveBeenCalledTimes( 1 );

        act( () => {
          jest.runOnlyPendingTimers();
        } );
        expect( g.onInteractionEnd ).toHaveBeenCalledTimes( 1 );

        g.wheel( {
          deltaY: 100,
          wheelDeltaY: -120
        } );

        expect( g.transform.scale ).toBeLessThan( 1 );
        expect( g.onInteractionStart ).toHaveBeenLastCalledWith( "zooming" );

        g.unmount();
      }
    );
  }
);

describe(
  "isMouseWheelEvent",
  () => {
    it(
      "reads a line-mode event, or a ±120 legacy notch on one axis, as a mouse wheel",
      () => {
        expect( isMouseWheelEvent( wheelEvent( {
          deltaY: 3,
          deltaMode: 1
        } ) ) ).toBe( true );
        expect( isMouseWheelEvent( wheelEvent( {
          deltaY: 100,
          wheelDeltaY: -120
        } ) ) ).toBe( true );
        // WebKit on macOS: a small pixel delta, still a ±120 notch.
        expect( isMouseWheelEvent( wheelEvent( {
          deltaY: -4,
          wheelDeltaY: 120
        } ) ) ).toBe( true );
      }
    );

    it(
      "reads two axes, a −3× legacy delta, or no legacy delta at all as a trackpad",
      () => {
        expect( isMouseWheelEvent( wheelEvent( {
          deltaX: 2,
          deltaY: 30
        } ) ) ).toBe( false );
        expect( isMouseWheelEvent( wheelEvent( {
          deltaY: 40,
          wheelDeltaY: -120
        } ) ) ).toBe( false );
        // Page zoom leaves the pixel delta fractional and the legacy one rounded.
        expect( isMouseWheelEvent( wheelEvent( {
          deltaY: 1.3333,
          wheelDeltaY: -4
        } ) ) ).toBe( false );
        expect( isMouseWheelEvent( wheelEvent( {
          deltaY: 30
        } ) ) ).toBe( false );
      }
    );
  }
);
