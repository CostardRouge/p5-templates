"use client";

import {
  useCallback, useState
} from "react";
import {
  type EnqueueRecordingResponse, type QueueHealthResponse
} from "@/types/recording.types";

export function useRecordingQueue() {
  const [
    isLoading,
    setIsLoading
  ] = useState( false );
  const [
    error,
    setError
  ] = useState<string | null>( null );

  const enqueueRecording = useCallback(
    async( formData: FormData ): Promise<string | null> => {
      setIsLoading( true );
      setError( null );

      try {
        const response = await fetch(
          "/api/recordings/enqueue",
          {
            method: "POST",
            body: formData
          }
        );

        if ( !response.ok ) {
          console.error(
            "[useRecordingQueue] HTTP error:",
            response.status,
            response.statusText
          );
        }

        const data: EnqueueRecordingResponse = await response.json();

        if ( !data.success ) {
          const errorMsg = data.error || "Failed to enqueue recording";

          console.error(
            "[useRecordingQueue] API returned error:",
            errorMsg
          );
          throw new Error( errorMsg );
        }

        if ( !data.jobId ) {
          console.error( "[useRecordingQueue] API returned success but no jobId" );
          throw new Error( "No job ID returned from server" );
        }

        console.log(
          "[useRecordingQueue] Successfully enqueued recording:",
          data.jobId
        );
        return data.jobId;
      } catch ( error ) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        console.error(
          "[useRecordingQueue] Error enqueuing recording:",
          error
        );
        setError( errorMessage );
        return null;
      } finally {
        setIsLoading( false );
      }
    },
    []
  );

  const getQueueHealth =
    useCallback(
      async(): Promise<QueueHealthResponse | null> => {
        setIsLoading( true );
        setError( null );

        try {
          const response = await fetch( "/api/recordings/health" );

          if ( !response.ok ) {
            throw new Error( "Failed to fetch queue health" );
          }

          const data: QueueHealthResponse = await response.json();

          return data;
        } catch ( error ) {
          const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

          setError( errorMessage );
          return null;
        } finally {
          setIsLoading( false );
        }
      },
      []
    );

  const controlQueue = useCallback(
    async( action: "pause" | "resume" ): Promise<boolean> => {
      setIsLoading( true );
      setError( null );

      try {
        const response = await fetch(
          "/api/recordings/control",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify( {
              action
            } )
          }
        );

        const data = await response.json();

        if ( !data.success ) {
          throw new Error( data.error || `Failed to ${ action } queue` );
        }

        return true;
      } catch ( error ) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        setError( errorMessage );
        return false;
      } finally {
        setIsLoading( false );
      }
    },
    []
  );

  return {
    enqueueRecording,
    getQueueHealth,
    controlQueue,
    isLoading,
    error
  };
}
