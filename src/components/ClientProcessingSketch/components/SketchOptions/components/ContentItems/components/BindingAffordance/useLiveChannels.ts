/**
 * The ids of the interaction channels currently being published.
 *
 * Some channel families are not declared anywhere — they are minted when the
 * hardware speaks. A MIDI controller's knobs are the case that forced this:
 * a Launchkey Mini's eight pots send CC 29, 79, 80, 104, 108, 109, 113 and 112,
 * so no manifest can list them ahead of time (see `interaction/sources.js`).
 * The binding picker therefore widens its list from the live snapshot instead.
 *
 * `channelBridge` publishes a snapshot EVERY FRAME, and turning that into React
 * state per frame is precisely the reconciler thrash the bridge exists to avoid
 * (its CSS vars are how meters animate without a render). So this hook compares
 * the set of ids and re-renders only when one appears or disappears — for MIDI,
 * once per knob, the first time it is touched.
 *
 * It is also only useful while a picker is open, which is why the subscription
 * is tied to the component's lifetime: mount it inside the popover panel, which
 * Headless UI unmounts on close, and nothing is subscribed the rest of the time.
 */
import {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  getChannelsSnapshot, subscribeChannels, type ChannelSnapshot
} from "@/lib/channelBridge";
import {
  observeForLearn
} from "./bindingUtils";

function idsOf( snapshot: ChannelSnapshot ): string[] {
  return Object.keys( snapshot ?? {} ).sort();
}

export function useLiveChannelIds(): string[] {
  const [
    ids,
    setIds
  ] = useState<string[]>( () => idsOf( getChannelsSnapshot() ) );
  const signature = useRef( ids.join( "|" ) );

  useEffect(
    () => {
      const read = ( snapshot: ChannelSnapshot ) => {
        const next = idsOf( snapshot );
        const nextSignature = next.join( "|" );

        if ( nextSignature === signature.current ) {
          return;
        }

        signature.current = nextSignature;
        setIds( next );
      };

      // The engine may have published since the initial state was computed.
      read( getChannelsSnapshot() );

      return subscribeChannels( read );
    },
    []
  );

  return ids;
}

/**
 * MIDI learn, the gesture: arm, move a control, it is assigned.
 *
 * It exists because a runtime channel cannot be picked from a list before it
 * exists, and because nobody knows their controller's CC numbers by heart.
 * `observeForLearn` does the scoring; this holds the armed state and the
 * subscription.
 *
 * `seenSignal` is the honest answer to the one failure that is otherwise
 * invisible: the snapshot is published from the draw loop (`pre-draw`), so a
 * PAUSED sketch publishes nothing and a knob can be turned all day with
 * nothing arriving. Rather than reaching for the play state, the hook reports
 * whether frames are flowing at all and lets the UI say so. The initial seed
 * deliberately reads the cached snapshot WITHOUT going through the subscriber,
 * or a paused sketch's last frame would look like a live signal.
 *
 * Arming stays armed until it captures, until it is pressed again, or until the
 * component unmounts — which, mounted inside the popover panel, means closing
 * the popover disarms it. No timeout: one that fired while someone was reaching
 * for a knob would be worse than an armed button they can see.
 */
export function useChannelLearn( onLearn: ( id: string ) => void ): {
  armed: boolean;
  seenSignal: boolean;
  arm: () => void;
  disarm: () => void;
} {
  const [
    armed,
    setArmed
  ] = useState( false );
  const [
    seenSignal,
    setSeenSignal
  ] = useState( false );
  const handler = useRef( onLearn );

  useEffect(
    () => {
      handler.current = onLearn;
    },
    [
      onLearn
    ]
  );

  useEffect(
    () => {
      if ( !armed ) {
        return;
      }

      const references = new Map<string, number>();
      let signalled = false;

      // Seed every channel already publishing, so one sitting still is not
      // mistaken for one that just moved. On this pass nothing can win.
      observeForLearn(
        getChannelsSnapshot(),
        references
      );

      return subscribeChannels( ( snapshot: ChannelSnapshot ) => {
        if ( !signalled ) {
          signalled = true;
          setSeenSignal( true );
        }

        const id = observeForLearn(
          snapshot,
          references
        );

        if ( id ) {
          setArmed( false );
          handler.current( id );
        }
      } );
    },
    [
      armed
    ]
  );

  const arm = useCallback(
    () => {
      setSeenSignal( false );
      setArmed( true );
    },
    []
  );

  const disarm = useCallback(
    () => setArmed( false ),
    []
  );

  return {
    armed,
    seenSignal,
    arm,
    disarm
  };
}
