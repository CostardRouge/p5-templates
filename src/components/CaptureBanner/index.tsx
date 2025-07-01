"use client";

import {
  JsonData, JsonEditor
} from "json-edit-react";
import React, {
  useEffect,
  useState
} from "react";
import {
  Film, Loader, SaveIcon
} from "lucide-react";

import {
  useRecordingQueue
} from "@/hooks/useRecordingQueue";

import useRecordingStatusStream from "@/hooks/useRecordingStatusStream";
import {
  JobId, RecordingSketchOptions, RecordingSketchSlideOption
} from "@/types/recording.types";

import fetchDownload from "@/components/utils/fetchDownload";
import ImageAssets from "@/components/CaptureBanner/components/ImageAssets";
import {
  resolveAssetURL
} from "@/shared/utils";

export default function Index( {
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

  const [
    templateCurrentSlide,
    setTemplateCurrentSlide
  ] = useState<{
    slide: RecordingSketchSlideOption,
    index: number,
  } | undefined>( );

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

    for ( const type of Object.keys( globalAssets ) ) {
      const fileList = globalAssets[ type as keyof typeof globalAssets ] || [
      ];

      await Promise.all( fileList.map( async(
        assetUrl: string, index: number
      ) => {
        const blob = await fetch( resolveAssetURL(
          assetUrl,
          options.id
        ) ).then( r => r.blob() );
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
          const blob = await fetch( resolveAssetURL(
            assetUrl,
            options.id
          ) ).then( r => r.blob() );
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

  useEffect(
    () => {
      setTemplateCurrentSlide( window?.getCurrentSlide?.() ?? undefined );
    },
    [
    ]
  );

  return (
    <div
      className="max-w-64 flex flex-col gap-1 fixed right-0 bottom-0 bg-white p-2 text-center border border-t-1 border-black z-50 rounded-t-sm drop-shadow-sm"
    >
      <div className="rounded-sm border border-black overflow-hidden">
        <JsonEditor
          collapse
          data={options}
          setData={setOptions}
          theme={{
            styles: {
              container: {
                backgroundColor: "#fffff",
                fontFamily: "monospace",
                fontSize: "small"
              },
            },
          }}
        />
      </div>

      <div className="rounded-sm border border-black text-black text-left bg-white">
        <span className="px-1 text-sm">root.assets.images</span>
        <ImageAssets
          options={options}
          scope="global"
          id={options.id}
        />
      </div>

      {options?.slides?.map( (
        slideOption, slideIndex
      ) => {
        return (
          <div
            key={`slide-${ slideIndex }`}
            className="rounded-sm border border-black text-black text-left bg-white"
          >
            <span className="px-1 text-sm">root.slides[{slideIndex}].assets.images</span>
            <ImageAssets
              id={options.id}
              options={slideOption}
              scope={{
                slide: slideIndex
              }}
            />
          </div>

        )
        ;
      } )}

      {!recordingProgress && (
        <button
          className="rounded-sm p-2 border border-black disabled:opacity-50 text-black bg-white text-sm"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? <Loader className="inline mr-1 h-4 animate-spin"/> :
            <Film className="inline h-4 mr-1"/>}
          <span className="align-middle">Start backend recording</span>
        </button>
      )}

      {recordingProgress && ( recordingProgress?.percentage !== 100 && recordingProgress?.status !== "completed" ) && (
        <div className="flex flex-col justify-start bg-white">
          <div
            className={`w-full h-8 ${ recordingProgress.status !== "failed" ? "bg-gray-200" : "bg-red-300" } rounded relative`}>
            <div
              className="h-full bg-black rounded"
              style={{
                width: `${ recordingProgress.percentage }%`
              }}
            />
            <span
              className="absolute top-0 left-0 h-full w-full p-1.5 mix-blend-difference text-white text-sm">{Math.round( recordingProgress?.percentage )}%</span>
          </div>

          <span className="text-sm text-black">
            {recordingProgress.status}: {recordingProgress?.currentStep?.name}
          </span>
        </div>
      )}

      {( recordingProgress?.percentage === 100 || recordingProgress?.status === "completed" ) && jobId && (
        <button
          className="rounded-sm p-2 border border-black text-black inline-block bg-white text-sm"
          onClick={async() => await fetchDownload( `/api/recordings/download/${ jobId }` )}
        >
          <SaveIcon className="inline align-middle mr-1 h-4"/>
          <span className="align-middle">Download</span>
        </button>
      )}
    </div>
  );
}