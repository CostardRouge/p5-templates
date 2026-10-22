"use client";

import {
  useCallback, useEffect, useRef
} from "react";
import {
  JobId, RecordingProgressionStream
} from "@/types/recording.types";

type UpdateCallback = ( update: {
  jobId: JobId;
  data: RecordingProgressionStream;
} ) => void;

/**
 * One EventSource for every job being watched, re-opened only when the SET of
 * jobs changes. `subscribe` and `unsubscribe` are stable across renders, so a
 * caller can list them as effect dependencies without the stream being torn
 * down and re-opened every time it re-renders — which, for the recordings
 * page, was on every progress message.
 */
function useMultiRecordingStatusStream() {
  const eventSourceRef = useRef<EventSource | null>( null );
  const subscribedJobs = useRef<Set<JobId>>( new Set() );
  const callbackRef = useRef<UpdateCallback | null>( null );

  const reopen = useCallback(
    () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;

      if ( subscribedJobs.current.size === 0 ) {
        return;
      }

      const url = `/api/progression/stream?ids=${ Array.from( subscribedJobs.current ).join( "," ) }`;
      const eventSource = new EventSource( url );

      eventSource.onmessage = ( event ) => {
        try {
          const {
            jobId, ...data
          } = JSON.parse( event.data );

          callbackRef.current?.( {
            jobId,
            data
          } );
        } catch( err ) {
          console.error(
            "Invalid SSE data:",
            err
          );
        }
      };

      // Left open on purpose: EventSource reconnects by itself after a
      // dropped connection. Closing it here made any blip permanent — the
      // progress bars froze until the page was reloaded.
      eventSource.onerror = ( err ) => {
        console.warn(
          "SSE error (the browser will retry)",
          err
        );
      };

      eventSourceRef.current = eventSource;
    },
    []
  );

  const subscribe = useCallback(
    (
      jobIds: JobId[], callback: UpdateCallback
    ) => {
      callbackRef.current = callback;

      const newIds = jobIds.filter( ( id ) => !subscribedJobs.current.has( id ) );

      if ( newIds.length === 0 ) {
        return;
      }

      newIds.forEach( ( id ) => subscribedJobs.current.add( id ) );
      reopen();
    },
    [
      reopen
    ]
  );

  const unsubscribe = useCallback(
    ( jobId: JobId ) => {
      if ( !subscribedJobs.current.delete( jobId ) ) {
        return;
      }

      reopen();
    },
    [
      reopen
    ]
  );

  useEffect(
    () => {
      return () => {
        eventSourceRef.current?.close();
      };
    },
    []
  );

  return {
    subscribe,
    unsubscribe
  };
}

export default useMultiRecordingStatusStream;
