/**
 * @jest-environment jsdom
 */

/**
 * The learn gesture end to end, driven by publishing real channel snapshots:
 * arming, the first-seen reference, the assignment, and — the case that broke
 * in the browser — arming a SECOND time on the same mounted picker.
 */
import {
  act, renderHook
} from "@testing-library/react";
import {
  publishChannels
} from "@/lib/channelBridge";
import {
  useChannelLearn
} from "../useLiveChannels";

const scalar = ( value: number ) => ( {
  type: "scalar" as const,
  value
} );

function publish( snapshot: Record<string, ReturnType<typeof scalar>> ) {
  act( () => {
    publishChannels( snapshot );
  } );
}

describe(
  "useChannelLearn",
  () => {
    beforeEach( () => {
      publishChannels( {} );
    } );

    it(
      "assigns the control that moves, and disarms itself",
      () => {
        const onLearn = jest.fn();
        const {
          result
        } = renderHook( () => useChannelLearn( onLearn ) );

        expect( result.current.armed ).toBe( false );

        act( () => result.current.arm() );
        expect( result.current.armed ).toBe( true );
        expect( result.current.seenSignal ).toBe( false );

        // First sighting seeds the reference; nothing is learned from it.
        publish( {
          "midi.cc108": scalar( 0.1 )
        } );
        expect( result.current.seenSignal ).toBe( true );
        expect( onLearn ).not.toHaveBeenCalled();

        publish( {
          "midi.cc108": scalar( 0.9 )
        } );
        expect( onLearn ).toHaveBeenCalledWith( "midi.cc108" );
        expect( result.current.armed ).toBe( false );
      }
    );

    it(
      "learns again on a second arm, on the same mounted picker",
      () => {
        const onLearn = jest.fn();
        const {
          result
        } = renderHook( () => useChannelLearn( onLearn ) );

        act( () => result.current.arm() );
        publish( {
          "midi.cc108": scalar( 0.1 )
        } );
        publish( {
          "midi.cc108": scalar( 0.9 )
        } );
        expect( onLearn ).toHaveBeenNthCalledWith(
          1,
          "midi.cc108"
        );

        // Re-arm: the previous run's references must not carry over, and the
        // channel that is now sitting still must not count as moving.
        act( () => result.current.arm() );
        expect( result.current.armed ).toBe( true );

        publish( {
          "midi.cc108": scalar( 0.9 ),
          "midi.cc79": scalar( 0.1 )
        } );
        expect( onLearn ).toHaveBeenCalledTimes( 1 );

        publish( {
          "midi.cc108": scalar( 0.9 ),
          "midi.cc79": scalar( 0.8 )
        } );
        expect( onLearn ).toHaveBeenNthCalledWith(
          2,
          "midi.cc79"
        );
        expect( result.current.armed ).toBe( false );
      }
    );

    it(
      "stops listening once disarmed by hand",
      () => {
        const onLearn = jest.fn();
        const {
          result
        } = renderHook( () => useChannelLearn( onLearn ) );

        act( () => result.current.arm() );
        publish( {
          "midi.cc29": scalar( 0.1 )
        } );
        act( () => result.current.disarm() );

        publish( {
          "midi.cc29": scalar( 0.9 )
        } );
        expect( onLearn ).not.toHaveBeenCalled();
      }
    );

    it(
      "reports no signal while nothing is published",
      () => {
        const onLearn = jest.fn();

        // A paused sketch: the cached snapshot is still there, but no new one
        // ever arrives, which is exactly what seenSignal is for.
        publishChannels( {
          "midi.cc29": scalar( 0.5 )
        } );

        const {
          result
        } = renderHook( () => useChannelLearn( onLearn ) );

        act( () => result.current.arm() );
        expect( result.current.armed ).toBe( true );
        expect( result.current.seenSignal ).toBe( false );
        expect( onLearn ).not.toHaveBeenCalled();
      }
    );
  }
);
