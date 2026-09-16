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
  useEffect, useRef, useState
} from "react";
import {
  getChannelsSnapshot, subscribeChannels, type ChannelSnapshot
} from "@/lib/channelBridge";

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
