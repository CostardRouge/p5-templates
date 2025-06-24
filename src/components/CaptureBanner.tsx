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
} from "@/lib/hooks/useRecordingQueue";

import useRecordingStatusStream from "@/lib/hooks/useRecordingStatusStream";
import {
  JobId, RecordingSketchOptions, RecordingSketchSlideOption
} from "@/types/recording.types";

import fetchDownload from "@/components/utils/fetchDownload";

export default function CaptureBanner( {
  name,
  options,
  setOptions
}: {
    name: string;
    options: RecordingSketchOptions;
    setOptions: ( nextOptions: JsonData ) => void;
} ) {
  const {
    enqueueRecording, isLoading
  } = useRecordingQueue();

  const [
    jobId,
    setJobId
  ] = useState<JobId | undefined>( );

  const {
    subscribeToRecordingStatus, recordingProgress
  } = useRecordingStatusStream();

  const handleSubmit = async() => {
    const formData = new FormData();

    formData.append(
      "template",
      `p5/${ name }`
    );
    formData.append(
      "options",
      JSON.stringify( options )
    );

    // Handle GLOBAL assets
    const globalAssets = options.assets || {
    };

    console.log( {
      ass: options.assets
    } );

    for ( const type of Object.keys( globalAssets ) ) {
      const fileList = globalAssets[ type as keyof typeof globalAssets ] || [
      ];

      await Promise.all( fileList.map( async(
        assetUrl: string, index: number
      ) => {
        const blob = await fetch( assetUrl ).then( r => r.blob() );
        const name = assetUrl.split( "/" ).pop() ?? `${ type }-${ index }`;

        formData.append(
          `file[global][${ type }]`,
          new File(
            [
              blob
            ],
            `global/${ type }/${ name }`,
            {
              type: blob.type
            }
          )
        );
      } ) );
    }

    // Handle SLIDE assets
    const slides: RecordingSketchSlideOption[] = options.slides || [
    ];

    for ( let i = 0; i < slides.length; i++ ) {
      const slide = slides[ i ];
      const assets = slide.assets || {
      };

      for ( const type of Object.keys( assets ) ) {
        const fileList = assets[ type as keyof typeof assets ] || [
        ];

        await Promise.all( fileList.map( async(
          assetUrl: string, index: number
        ) => {
          const blob = await fetch( assetUrl ).then( r => r.blob() );
          const prefix = `slide-${ i }-${ type }-${ index }`;
          const name = assetUrl.split( "/" ).pop() ?? prefix;

          formData.append(
            `file[slide-${ i }][${ type }]`,
            new File(
              [
                blob
              ],
              `slide-${ i }/${ type }/${ name }`,
              {
                type: blob.type
              }
            )
          );
        } ) );
      }
    }

    const jobId = await enqueueRecording( formData );

    if ( jobId !== null ) {
      setJobId( jobId );

      subscribeToRecordingStatus( jobId );
    }
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
          className="rounded-sm px-4 border border-black disabled:opacity-50 text-black"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? <Loader className="inline mr-1 animate-spin"/> :
            <Download className="inline mr-1"/>}
          Start backend recording
        </button>
      )}

      {recordingProgress && ( recordingProgress?.percentage !== 100 && recordingProgress?.status !== "completed" ) && ( <div className="flex flex-col justify-start">
        <div className="w-64 h-full bg-gray-200 rounded">
          <div
            className="h-full bg-black rounded"
            style={{
              width: `${ recordingProgress.percentage }%`
            }}
          />
        </div>

        <span className="text-sm text-black">
          {recordingProgress.status}: {recordingProgress?.currentStep?.name} – {Math.round( recordingProgress?.percentage )}%
        </span>
      </div> ) }

      { ( recordingProgress?.percentage === 100 || recordingProgress?.status === "completed" ) && jobId && (
        <button
          className="rounded-sm px-4 border border-black text-black inline-block"
          onClick={async() => await fetchDownload( `/api/recordings/download/${ jobId }` )}
        >
          <Download className="inline mr-1"/>
          Download
        </button>
      ) }
    </div>
  );
}