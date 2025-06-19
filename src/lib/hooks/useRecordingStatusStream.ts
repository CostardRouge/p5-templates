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

  const subscribeToRecordingStatus = useCallback(
    ( jobId: JobId ) => {
      const source = new EventSource( `/api/progression/stream/${ jobId }` );

      source.onmessage = async( event: MessageEvent<string> ): Promise<void> => {
        try {
          const parsedRecordingProgress: RecordingProgressionStream | null = JSON.parse( event.data );

          setRecordingProgress( parsedRecordingProgress );

          if ( parsedRecordingProgress?.percentage === 100 ) {
            source.close();
          }
        }
        catch ( error ) {
          console.error( error );
          source.close();
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