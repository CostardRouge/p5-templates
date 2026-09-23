/**
 * @jest-environment jsdom
 */

/**
 * A pad pressing a button, driven by real channel snapshots: the rising edge
 * fires once, holding does not repeat, a release re-arms, and the row follows
 * the port that is open.
 */
import {
  act, renderHook
} from "@testing-library/react";
import {
  publishChannels, publishMidiPortName
} from "@/lib/channelBridge";
import {
  usePadTrigger
} from "../usePadTrigger";

const DAW_PORT = "Launchkey Mini MK3 DAW Port";
const MIDI_PORT = "Launchkey Mini MK3 MIDI Port";

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
  "usePadTrigger",
  () => {
    beforeEach( () => {
      publishMidiPortName( DAW_PORT );
      publishChannels( {} );
    } );

    it(
      "fires once on the rising edge, not while held, and again after a release",
      () => {
        const onFire = jest.fn();

        renderHook( () => usePadTrigger(
          "pad.1",
          1,
          onFire
        ) );

        publish( {
          "midi.note96": scalar( 1 )
        } );
        expect( onFire ).toHaveBeenCalledTimes( 1 );
        expect( onFire ).toHaveBeenCalledWith( 0 );

        // Held: the same level frame after frame is not a new press.
        publish( {
          "midi.note96": scalar( 1 )
        } );
        publish( {
          "midi.note96": scalar( 0.8 )
        } );
        expect( onFire ).toHaveBeenCalledTimes( 1 );

        publish( {
          "midi.note96": scalar( 0 )
        } );
        publish( {
          "midi.note96": scalar( 0.9 )
        } );
        expect( onFire ).toHaveBeenCalledTimes( 2 );
      }
    );

    it(
      "hands a row its option index, from consecutive pads",
      () => {
        const onFire = jest.fn();

        renderHook( () => usePadTrigger(
          "pad.1",
          3,
          onFire
        ) );

        publish( {
          "midi.note98": scalar( 1 )
        } );
        expect( onFire ).toHaveBeenCalledWith( 2 );

        // Off the row: the fourth pad is nobody's.
        publish( {
          "midi.note98": scalar( 0 ),
          "midi.note99": scalar( 1 )
        } );
        expect( onFire ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "waits out a pad that is already down when it mounts",
      () => {
        const onFire = jest.fn();

        publishChannels( {
          "midi.note96": scalar( 1 )
        } );

        renderHook( () => usePadTrigger(
          "pad.1",
          1,
          onFire
        ) );

        publish( {
          "midi.note96": scalar( 1 )
        } );
        expect( onFire ).not.toHaveBeenCalled();

        publish( {
          "midi.note96": scalar( 0 )
        } );
        publish( {
          "midi.note96": scalar( 1 )
        } );
        expect( onFire ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "follows the port: the same pad sends another note on the MIDI port",
      () => {
        const onFire = jest.fn();

        renderHook( () => usePadTrigger(
          "pad.1",
          1,
          onFire
        ) );

        act( () => {
          publishMidiPortName( MIDI_PORT );
        } );
        publish( {
          "midi.note96": scalar( 1 )
        } );
        expect( onFire ).not.toHaveBeenCalled();

        publish( {
          "midi.note40": scalar( 1 )
        } );
        expect( onFire ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "does nothing without a control, or on an unknown port",
      () => {
        const onFire = jest.fn();

        const {
          rerender
        } = renderHook(
          ( {
            control
          }: { control: string | undefined } ) => usePadTrigger(
            control,
            1,
            onFire
          ),
          {
            initialProps: {
              control: undefined as string | undefined
            }
          }
        );

        publish( {
          "midi.note96": scalar( 1 )
        } );
        expect( onFire ).not.toHaveBeenCalled();

        act( () => {
          publishMidiPortName( "" );
        } );
        rerender( {
          control: "pad.1"
        } );
        publish( {
          "midi.note96": scalar( 0 )
        } );
        publish( {
          "midi.note96": scalar( 1 )
        } );
        expect( onFire ).not.toHaveBeenCalled();
      }
    );
  }
);
