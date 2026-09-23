import {
  useEffect, useRef
} from "react";
import {
  getChannelsSnapshot, getMidiPortName, subscribeChannels, type ChannelSnapshot
} from "@/lib/channelBridge";
import {
  padSequence
} from "@/p5/utils/interaction/controllerMap.js";

// A Schmitt trigger on the pad's 0..1 level: fire when it climbs past ON,
// re-arm once it has dropped below OFF. Two thresholds so a pad held at a
// bounce-prone velocity cannot fire twice, and so a partial release never
// counts as a new press.
const ON = 0.5;
const OFF = 0.25;

function level( channel: ChannelSnapshot[ string ] | undefined ): number {
  return channel && channel.type === "scalar" && Number.isFinite( channel.value )
    ? channel.value
    : 0;
}

/**
 * Fire `onFire( index )` on the RISING edge of each of `count` consecutive
 * pads starting at `control` (`"pad.1"`), never on release and never again
 * while the pad is held.
 *
 * The pad's channel is diffed frame to frame from the same snapshot the learn
 * gesture reads (`subscribeChannels`), so nothing here touches the engine or
 * the binding resolver: a pad press is an editor event, exactly like a click,
 * and the handler it reaches is the click's own. The pads are resolved
 * against whichever port is open at the time of each snapshot, so switching
 * port on the controller re-points the row without a remount.
 *
 * A pad already down when the subscription starts is seeded as high and does
 * not fire — mounting a panel must not press its buttons. Nothing is
 * subscribed while `control` is undefined (feature off, no pad declared).
 */
export function usePadTrigger(
  control: string | undefined,
  count: number,
  onFire: ( index: number ) => void
): void {
  const handler = useRef( onFire );

  useEffect(
    () => {
      handler.current = onFire;
    },
    [
      onFire
    ]
  );

  useEffect(
    () => {
      if ( !control || !( count > 0 ) ) {
        return;
      }

      let port: string | null = null;
      let ids: string[] | null = null;
      let high: boolean[] = [];

      const resolve = (
        snapshot: ChannelSnapshot, seed: boolean
      ) => {
        const name = getMidiPortName();

        if ( name === port ) {
          return;
        }

        port = name;
        ids = padSequence(
          name,
          control,
          count
        );
        // Seed against the current levels so a pad that is down right now is
        // waited out, not counted.
        high = ( ids ?? [] ).map( ( id ) => seed && level( snapshot[ id ] ) > ON );
      };

      resolve(
        getChannelsSnapshot(),
        true
      );

      return subscribeChannels( ( snapshot ) => {
        resolve(
          snapshot,
          true
        );

        if ( !ids ) {
          return;
        }

        ids.forEach( (
          id, index
        ) => {
          const value = level( snapshot[ id ] );

          if ( !high[ index ] && value > ON ) {
            high[ index ] = true;
            handler.current( index );
          } else if ( high[ index ] && value < OFF ) {
            high[ index ] = false;
          }
        } );
      } );
    },
    [
      control,
      count
    ]
  );
}
