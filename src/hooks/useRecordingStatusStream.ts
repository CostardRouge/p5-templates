"use client";

import {
  useState, useCallback
} from "react";
import {
  JobId, RecordingProgressionStream
} from "@/types/recording.types";

function useRecordingStatusStream() {
  const [
    recordingProgress,
    setRecordingProgress
  ] = useState<RecordingProgressionStream | null>( null );

  const onError = () => {
    setRecordingProgress( {
      currentStep: {
        name: "network error",
        progression: 100
      },
      percentage: 0,
      status: "failed"
    } );
  };

  const subscribeToRecordingStatus = useCallback(
    ( jobId: JobId ) => {
      const source = new EventSource( `/api/progression/stream/${ jobId }` );

      source.onerror = event => {
        console.error( event );
        source.close();
        onError();
      };

      source.onmessage = async( event: MessageEvent<string> ): Promise<void> => {
        try {
          const parsedRecordingProgress: RecordingProgressionStream | null = JSON.parse( event.data );

          setRecordingProgress( parsedRecordingProgress );

          if ( parsedRecordingProgress?.percentage === 100 ) {
            source.close();
          }

          if ( parsedRecordingProgress?.status === "failed" ) {
            source.close();
          }

          if ( parsedRecordingProgress?.status === "completed" ) {
            source.close();
          }
        }
        catch ( error ) {
          console.error( error );
          source.close();
          onError();
        }
      };
    },
    [
    ]
  );

  return {
    subscribeToRecordingStatus,
    recordingProgress
  };
}

export default useRecordingStatusStream;