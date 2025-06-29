"use client";

import {
  useEffect, useRef
} from "react";
import {
  JobId, RecordingProgressionStream
} from "@/types/recording.types";

type UpdateCallback = ( update: {
  jobId: JobId;
  data: RecordingProgressionStream;
} ) => void;

function useMultiRecordingStatusStream() {
  const eventSourceRef = useRef<EventSource | null>( null );
  const subscribedJobs = useRef<Set<JobId>>( new Set() );
  const callbackRef = useRef<UpdateCallback | null>( null );

  const subscribe = (
    jobIds: JobId[], callback: UpdateCallback
  ) => {
    const newIds = jobIds.filter( id => !subscribedJobs.current.has( id ) );

    if ( newIds.length === 0 ) return;

    newIds.forEach( id => subscribedJobs.current.add( id ) );
    callbackRef.current = callback;

    const url = `/api/progression/stream?ids=${ Array.from( subscribedJobs.current ).join( "," ) }`;

    // Close previous and re-open
    if ( eventSourceRef.current ) {
      eventSourceRef.current.close();
    }

    eventSourceRef.current = new EventSource( url );

    eventSourceRef.current.onmessage = ( event ) => {
      try {
        const {
          jobId, ...data
        } = JSON.parse( event.data );

        callbackRef.current?.( {
          jobId,
          data
        } );
      } catch ( err ) {
        console.error(
          "Invalid SSE data:",
          err
        );
      }
    };

    eventSourceRef.current.onerror = ( err ) => {
      console.warn(
        "SSE error",
        err
      );
      eventSourceRef.current?.close();
    };
  };

  const unsubscribe = ( jobId: JobId ) => {
    if ( !subscribedJobs.current.has( jobId ) ) return;
    subscribedJobs.current.delete( jobId );

    // Reconnect if jobs remain
    if ( subscribedJobs.current.size > 0 && callbackRef.current ) {
      // Rebuild the full subscription with current job list
      const currentJobs = Array.from( subscribedJobs.current );

      subscribe(
        currentJobs,
        callbackRef.current
      );
    } else {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    }
  };

  useEffect(
    () => {
      return () => {
        eventSourceRef.current?.close();
      };
    },
    [
    ]
  );

  return {
    subscribe,
    unsubscribe
  };
}

export default useMultiRecordingStatusStream;