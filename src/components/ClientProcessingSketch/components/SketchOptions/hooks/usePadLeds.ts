import {
  useEffect
} from "react";
import {
  publishPadLeds
} from "@/lib/padLedBridge";
import {
  PAD_COLORS, padControlAt
} from "@/p5/utils/interaction/controllerMap.js";

type PadLedColors = {
  active?: number;
  idle?: number;
};

/**
 * Publish what the pads driving this field should show: `count` consecutive
 * pads from `control`, the one at `activeIndex` in the active colour, the
 * others idle. A lone button passes `count = 1` and no active index, so its
 * pad glows idle — "this pad does something" — for as long as the field is
 * mounted. Withdrawn on unmount and whenever the field stops naming a pad.
 *
 * Only the wish crosses over, keyed by abstract control; the engine resolves
 * it against the open port and sends the difference (see `padLeds.js`).
 */
export function usePadLeds(
  owner: string,
  control: string | undefined,
  count: number,
  activeIndex: number,
  led: PadLedColors | undefined
): void {
  const active = led?.active ?? PAD_COLORS.active;
  const idle = led?.idle ?? PAD_COLORS.idle;

  useEffect(
    () => {
      if ( !control || !( count > 0 ) ) {
        publishPadLeds(
          owner,
          null
        );

        return;
      }

      const entries = [];

      for ( let index = 0; index < count; index++ ) {
        const pad = padControlAt(
          control,
          index
        );

        if ( !pad ) {
          break;
        }

        entries.push( {
          control: pad,
          color: index === activeIndex ? active : idle,
          mode: "static" as const
        } );
      }

      publishPadLeds(
        owner,
        entries
      );

      return () => publishPadLeds(
        owner,
        null
      );
    },
    [
      owner,
      control,
      count,
      activeIndex,
      active,
      idle
    ]
  );
}
