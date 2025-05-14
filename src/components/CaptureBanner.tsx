"use client";

import {
  JsonData, JsonEditor
} from "json-edit-react";
import React, {
  useState
} from "react";
import {
  Download, Loader
} from "lucide-react";

import fetchDownload from "@/components/utils/fetchDownload";

type ProgressData = {
 stepName: string; percentage: number
} | null;

export default function CaptureBanner( {
  name,
  options,
  setOptions
}: {
    name: string;
    options: Record<string, unknown>;
    setOptions: ( nextOptions: JsonData ) => void;
} ) {
  const [
    isRecording,
    setIsRecording
  ] = useState( false );
  const [
    recordingProgress,
    setRecordingProgress
  ] = useState<ProgressData>( null );

  function subscribeToRecordingProgress( jobId: string ): void {
    const source = new EventSource( `/api/record-progress?id=${ jobId }` );

    source.onmessage = async( event: MessageEvent<string> ): Promise<void> => {
      const progress: {
        step: string;
        percentage: number
      } = JSON.parse( event.data );

      setRecordingProgress( {
        stepName: progress.step,
        percentage: progress.percentage,
      } );

      if ( progress.step === "done" ) {
        source.close();
        await fetchDownload(
          `/api/video?id=${ jobId }`,
          {
            method: "GET",
          }
        );
        setIsRecording( false );
        setRecordingProgress( null );
      }

      if ( progress.step === "error" ) {
        source.close();
        alert( "Recording failed" );
        setIsRecording( false );
        setRecordingProgress( null );
      }
    };
  }

  async function startBackendRecording(): Promise<void> {
    const formData = new FormData();

    formData.append(
      "options",
      JSON.stringify( options )
    );

    if ( Array.isArray( options.assets ) ) {
      await Promise
        .all( options.assets
          .map( async( assetUrl: string, index: number ) => {
            const assetResponse = await fetch( assetUrl );
            const assetBlob = await assetResponse.blob();
            const assetName = assetUrl.split( "/" ).pop() ?? `asset-${ index }`;

            formData
              .append(
                "files[]",
                new File(
                  [
                    assetBlob
                  ],
                  assetName,
                  {
                    type: assetBlob.type
                  }
                )
              );
          } ), );
    }

    setIsRecording( true );

    const startResponse = await fetch(
      `/api/server-record/${ encodeURIComponent( name ) }`,
      {
        method: "POST",
        body: formData,
      }
    );

    if ( !startResponse.ok ) {
      alert( "Could not start recording" );
      setIsRecording( false );
      return;
    }

    const startResponseJson: {
      jobId: string
    } = await startResponse.json();

    subscribeToRecordingProgress( startResponseJson.jobId );
  }

  return (
    <div
      className="flex justify-center gap-1 fixed left-0 bottom-0 w-full bg-white p-1 text-center border border-t-1 border-black z-50">
      <div className="rounded-sm border border-black">
        <JsonEditor
          collapse
          data={options}
          setData={setOptions}
          theme={{
            styles: {
              container: {
                backgroundColor: "#f6f6f6",
                fontFamily: "monospace"
              },
            },
          }}
        />
      </div>

      {!recordingProgress && (
        <button
          className="rounded-sm px-4 border border-black disabled:opacity-50"
          onClick={startBackendRecording}
          disabled={isRecording}
        >
          {isRecording ? <Loader className="inline mr-1 animate-spin"/> :
            <Download className="inline mr-1"/>}
          Start backend recording
        </button>
      )}

      {isRecording && recordingProgress && (
        <div className="flex flex-col justify-start">
          <div className="w-64 h-full bg-gray-200 rounded">
            <div
              className="h-full bg-black rounded"
              style={{
                width: `${ recordingProgress.percentage }%`
              }}
            />
          </div>

          <span className="text-sm">
            {recordingProgress.stepName} – {Math.round( recordingProgress.percentage )}%
          </span>
        </div>
      ) }
    </div>
  )
  ;
}