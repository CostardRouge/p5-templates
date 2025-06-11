"use client";

import {
  useState, useCallback
} from "react";
import {
  EnqueueRecordingRequest,
  EnqueueRecordingResponse,
  QueueHealthResponse
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
            body: formData,
          }
        );

        const data: EnqueueRecordingResponse = await response.json();

        if ( !data.success ) {
          throw new Error( data.error || "Failed to enqueue recording" );
        }

        return data.jobId || null;
      } catch ( error ) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        setError( errorMessage );
        return null;
      } finally {
        setIsLoading( false );
      }
    },
    [
    ]
  );

  const getQueueHealth = useCallback(
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
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        setError( errorMessage );
        return null;
      } finally {
        setIsLoading( false );
      }
    },
    [
    ]
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
              "Content-Type": "application/json",
            },
            body: JSON.stringify( {
              action
            } ),
          }
        );

        const data = await response.json();

        if ( !data.success ) {
          throw new Error( data.error || `Failed to ${ action } queue` );
        }

        return true;
      } catch ( error ) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        setError( errorMessage );
        return false;
      } finally {
        setIsLoading( false );
      }
    },
    [
    ]
  );

  return {
    enqueueRecording,
    getQueueHealth,
    controlQueue,
    isLoading,
    error,
  };
}