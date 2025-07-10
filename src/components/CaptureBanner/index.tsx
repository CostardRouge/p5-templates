"use client";

import {
  JsonData, JsonEditor
} from "json-edit-react";
import React, {
  useEffect,
  useState
} from "react";
import {
  ArrowDownFromLine,
  Loader, SaveIcon, Archive, Clapperboard, Save
} from "lucide-react";

import {
  useRecordingQueue
} from "@/hooks/useRecordingQueue";

import useRecordingStatusStream from "@/hooks/useRecordingStatusStream";
import {
  JobId, JobModel, JobStatusEnum, RecordingSketchOptions, RecordingSketchSlideOption
} from "@/types/recording.types";

import fetchDownload from "@/components/utils/fetchDownload";
import ImageAssets from "@/components/CaptureBanner/components/ImageAssets";
import {
  resolveAssetURL, getScopeAssetPath
} from "@/shared/utils";
import clsx from "clsx";

export default function CaptureBanner( {
  name,
  options,
  setOptions,
  persistedJob
}: {
    name: string;
    options: RecordingSketchOptions;
    setOptions: ( nextOptions: JsonData ) => void;
    persistedJob?: JobModel
} ) {
  const {
    enqueueRecording, isLoading
  } = useRecordingQueue();

  const [
    jobId,
    setJobId
  ] = useState<JobId | undefined>( );

  const [
    saving,
    setSaving
  ] = useState<boolean>( false );

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

  const handleSubmit = async(
    status: JobStatusEnum = "active", persistedJobId?: JobId
  ) => {
    if ( status === "draft" ) {
      setSaving( true );
    }

    const formData = new FormData();

    if ( persistedJobId ) {
      formData.append(
        "jobId",
        persistedJobId
      );
    }

    formData.append(
      "status",
      status
    );
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
              getScopeAssetPath(
                name,
                type,
                {
                  slide: i
                }
              ),
              {
                type: blob.type
              }
            )
          );
        } ) );
      }
    }

    const newJobId = await enqueueRecording( formData );

    if ( newJobId !== null ) {
      if ( status === "active" ) {
        setJobId( newJobId );

        subscribeToRecordingStatus( newJobId );
      }

      if ( status === "draft" ) {
        window.location.href = `${ name }?id=${ newJobId }`;
      }
    }
    else if ( status === "draft" ) {
      setSaving( false );
    }
  };

  useEffect(
    () => {
      setTemplateCurrentSlide( window?.getCurrentSlide?.() ?? undefined );
    },
    [
    ]
  );

  const [
    expanded,
    setExpanded
  ] = useState( true );

  return (
    <div
      data-no-zoom=""
      className="w-64 flex flex-col gap-1 absolute right-0 bottom-0 bg-white p-2 border border-b-0 border-gray-400 shadow shadow-black-300 drop-shadow-sm border-r-0 z-50 rounded-tl-sm"
      style={ {
        maxHeight: "calc(60svh)",
      } }
    >
      <button
        onClick={() => setExpanded( e => !e )}
        className="text-gray-500 text-sm"

        aria-label={expanded ? "Collapse controls" : "Expand controls"}
      >
        <ArrowDownFromLine
          className="inline text-gray-500 h-4"
          style={{
            rotate: expanded ? "0deg" : "180deg"
          }}
        />
        <span>{expanded ? "hide" : "show"} options</span>
      </button>

      {expanded && (
        <>
          <div className="mt-2 rounded-sm border border-gray-400 overflow-y-scroll min-h-12">
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

          <div className="rounded-sm border border-gray-400 text-black text-left bg-white">
            <span className="px-1 text-xs text-gray-500">root.assets.images</span>
            <ImageAssets
              assets={options?.assets}
              scope="global"
              id={options.id}
            />
          </div>

          <div className="overflow-y-scroll flex flex-col gap-1 rounded-sm border-t border-b border-gray-400">
            {options?.slides?.map( (
              slideOption, slideIndex
            ) => (
              <div
                key={`slide-${ slideIndex }`}
                className={clsx(
                  "border border-gray-400 text-black text-left bg-white",
                  slideIndex === 0 && "border-t-0",
                  slideIndex === ( options?.slides?.length ?? 0 ) - 1 && "border-b-0"
                )}
              >
                <span className="px-1 text-xs text-gray-500">root.slides[{slideIndex}].assets.images</span>
                <ImageAssets
                  id={options.id}
                  assets={slideOption?.assets}
                  scope={{
                    slide: slideIndex
                  }}
                />
              </div>
            ) )}
          </div>

          {!recordingProgress && (
            <div className="flex gap-1 h-auto ">
              {
                persistedJob?.status === "draft" && (
                  <button
                    className="rounded-sm p-2 border border-gray-400 shadow shadow-gray-200 disabled:opacity-50 text-gray-500 hover:text-black active:text-black bg-white text-sm"
                    onClick={() => handleSubmit(
                      "draft",
                      persistedJob.id
                    )}
                    disabled={isLoading}
                  >
                    {saving ? <Loader className="inline mr-1 h-4 animate-spin"/> :
                      <Save className="inline h-4 mr-1"/>}
                    <span className="align-middle">Save</span>
                  </button>
                )
              }

              {
                persistedJob?.status !== "draft" && ( <button
                  className="rounded-sm p-2 border border-gray-400 shadow shadow-gray-200 disabled:opacity-50 text-gray-500 hover:text-black active:text-black bg-white text-sm"
                  onClick={() => handleSubmit( "draft" )}
                  disabled={isLoading}
                >
                  {saving ? <Loader className="inline mr-1 h-4 animate-spin"/> :
                    <Archive className="inline h-4 mr-1"/>}
                  <span className="align-middle">Draft</span>
                </button>
                )}

              <button
                className="flex-1 rounded-sm p-2 border border-gray-400 shadow shadow-gray-200 text-gray-500 hover:text-black active:text-black bg-white text-sm disabled:opacity-50 disabled:text-gray-500"
                onClick={() => handleSubmit()}
                disabled={isLoading || saving}
              >
                {isLoading && !saving ? <Loader className="inline mr-1 h-4 animate-spin"/> :
                  <Clapperboard className="inline h-4 mr-1"/>}
                <span className="align-middle">Export in .mp4</span>
              </button>
            </div>
          )}

          {recordingProgress && ( recordingProgress?.percentage !== 100 && recordingProgress?.status !== "completed" ) && (
            <div className="flex flex-col justify-start bg-white text-center">
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
              className="rounded-sm p-2 border border-gray-400 text-black inline-block bg-white text-sm shadow-gray-200"
              onClick={async() => await fetchDownload( `/api/recordings/download/${ jobId }` )}
            >
              <SaveIcon className="inline align-middle mr-1 h-4"/>
              <span className="align-middle">Download</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}