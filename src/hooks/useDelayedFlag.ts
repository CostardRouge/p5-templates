import {
  useEffect, useState
} from "react";

/**
 * `true` only once `active` has stayed true for `delayMs`; back to `false`
 * immediately when it goes false.
 *
 * Used to gate the sketch loading screen: a sketch with no assets — or one
 * whose images are already warm in the cache — is ready within a frame or two,
 * and mounting a poster plus a progress bar for that long reads as a flicker
 * rather than as feedback. Below the threshold the user simply sees the sketch.
 */
export function useDelayedFlag(
  active: boolean,
  delayMs = 150
): boolean {
  const [
    flag,
    setFlag
  ] = useState( false );

  useEffect(
    () => {
      if ( !active ) {
        return;
      }

      const timer = setTimeout(
        () => setFlag( true ),
        delayMs
      );

      // Reset on the way out rather than in the effect body, so a later
      // re-activation waits out the delay again instead of showing instantly.
      return () => {
        clearTimeout( timer );
        setFlag( false );
      };
    },
    [
      active,
      delayMs
    ]
  );

  return active && flag;
}

export default useDelayedFlag;
