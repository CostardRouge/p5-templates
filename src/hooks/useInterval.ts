"use client";

import {
  useEffect, useRef, useCallback
} from "react";

type UseIntervalOptions = {
  callback: () => void | Promise<void>;
  enabled: boolean;
  intervalMs?: number;
  preventConcurrent?: boolean;
};

/**
 * Hook that executes a callback at a specified interval when enabled
 * @param callback - Function to call at each interval
 * @param enabled - Whether the interval is enabled
 * @param intervalMs - Interval in milliseconds (default: 10000 = 10 seconds)
 * @param preventConcurrent - Prevent concurrent executions (default: true)
 */
export function useInterval( {
  callback,
  enabled,
  intervalMs = 10000,
  preventConcurrent = true
}: UseIntervalOptions ) {
  const intervalRef = useRef<NodeJS.Timeout | null>( null );
  const isExecutingRef = useRef( false );

  const execute = useCallback(
    async() => {
      if ( preventConcurrent && isExecutingRef.current ) {
        return;
      }

      try {
        isExecutingRef.current = true;
        await callback();
      } catch ( error ) {
        console.error(
          "[useInterval] Callback execution failed:",
          error
        );
      } finally {
        isExecutingRef.current = false;
      }
    },
    [
      callback,
      preventConcurrent
    ]
  );

  useEffect(
    () => {
      if ( !enabled ) {
        if ( intervalRef.current ) {
          clearInterval( intervalRef.current );
          intervalRef.current = null;
        }
        return;
      }

      // Start interval
      intervalRef.current = setInterval(
        () => {
          execute();
        },
        intervalMs
      );

      return () => {
        if ( intervalRef.current ) {
          clearInterval( intervalRef.current );
          intervalRef.current = null;
        }
      };
    },
    [
      enabled,
      intervalMs,
      execute
    ]
  );
}
