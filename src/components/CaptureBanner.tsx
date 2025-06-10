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

import {
  useRecordingQueue
} from "@/lib/hooks/use-recording-queue";

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
    recordingProgress,
    setRecordingProgress
  ] = useState<ProgressData>( null );

  const {
    enqueueRecording, isLoading, error
  } = useRecordingQueue();

  console.log( {
    isLoading,
    error
  } );

  const handleSubmit = async() => {
    const jobId = await enqueueRecording( {
      template: name,
      formData: {
        options
      }
    } );

    console.log(
      "Job created:",
      jobId
    );
  };

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
          className="rounded-sm px-4 border border-black disabled:opacity-50 text-black"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? <Loader className="inline mr-1 animate-spin"/> :
            <Download className="inline mr-1"/>}
          Start backend recording
        </button>
      )}

      {isLoading && recordingProgress && (
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