"use client";

import React, {
  useState
} from "react";
import {
  Archive, Clapperboard, Loader, Save, SaveIcon
} from "lucide-react";

import {
  useRecordingQueue
} from "@/hooks/useRecordingQueue";

import useRecordingStatusStream from "@/hooks/useRecordingStatusStream";
import {
  JobId, JobModel, JobStatusEnum
} from "@/types/recording.types";

import fetchDownload from "@/components/utils/fetchDownload";
import {
  getScopeAssetPath, resolveAssetURL
} from "@/p5-sketches/shared/utils";
import {
  SketchOption, SlideOption
} from "@/types/sketch.types";

export default function CaptureActions( {
  name,
  options,
  persistedJob
}: {
    name: string;
    options: SketchOption;
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

  const {
    subscribeToRecordingStatus, recordingProgress
  } = useRecordingStatusStream();

  const handleSubmit = async(
    status: JobStatusEnum = "active",
    persistedJobId?: JobId
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
    const slides: SlideOption[] = options.slides || [
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
    } else if ( status === "draft" ) {
      setSaving( false );
    }
  };

  return (
    <>
      {!recordingProgress && (
        <div className="flex gap-1 h-auto">
          {
            persistedJob?.status === "draft" && (
              <button
                className="rounded-lg p-1 border border-theme border-b-2 disabled:opacity-50 text-foreground active:text-foreground bg-background text-xs"
                onClick={() => handleSubmit(
                  "draft",
                  persistedJob.id
                )}
                disabled={isLoading}
              >
                {saving ? <Loader className="inline h-3 animate-spin"/> :
                  <Save className="inline h-3"/>}
                <span className="align-middle">Save</span>
              </button>
            )
          }

          {
            persistedJob?.status !== "draft" && ( <button
              className="flex-2 rounded-lg px-2 py-1 border border-theme border-b-2 disabled:opacity-50 text-foreground bg-background text-xs"
              onClick={() => handleSubmit( "draft" )}
              disabled={isLoading}
            >
              {saving ? <Loader className="inline h-3 animate-spin"/> :
                <Archive className="inline h-3" />}
              <span className="align-middle">Draft</span>
            </button>
            )}

          {/* <button*/}
          {/*  className="flex-1 rounded-xl p-1 border border-theme border-b-2 text-foreground bg-background text-xs"*/}
          {/*  onClick={async() => {*/}
          {/*    await window?.startLoopRecording( {*/}
          {/*      format: "webm"*/}
          {/*    } );*/}
          {/*  }}*/}
          {/* >*/}
          {/*  <CassetteTapeIcon className="inline h-3" />*/}
          {/*  <span className="align-middle">Record in .webm</span>*/}
          {/* </button>*/}

          <button
            className="flex-1 rounded-lg p-1 border border-theme border-b-2 text-foreground bg-background text-xs"
            onClick={async() => {
              await window?.startLoopRecording( {
                format: "webm"
              } );
            }}
          >
            <Save className="inline h-3" />
            <span className="align-middle">.webm</span>
          </button>

          <button
            className="flex-1 rounded-lg p-1 border border-theme border-b-2 text-foreground active:text-foreground bg-background text-xs disabled:opacity-50 disabled:text-foreground"
            onClick={() => handleSubmit()}
            disabled={isLoading || saving}
          >
            {isLoading && !saving ? <Loader className="inline h-3 animate-spin"/> :
              <Clapperboard className="inline h-3" />}
            <span className="align-middle">.mp4</span>
          </button>
        </div>
      )}

      {recordingProgress && ( recordingProgress?.percentage !== 100 && recordingProgress?.status !== "completed" ) && (
        <div className="flex flex-col justify-start bg-background text-center items-center">
          <div
            className={`w-full h-6 rounded-lg relative ring-1 ${
              recordingProgress.status !== "failed" ? "ring-gray-300" : "ring-red-400"
            }`}
          >
            <div className="absolute inset-0 rounded-xl bg-background" />

            <div
              className="absolute inset-y-0 left-0 bg-hover rounded-xl"
              style={{
                width: `${ recordingProgress.percentage }%`
              }}
            />

            {/* blend-inverting label */}
            <span
              className="absolute inset-0 p-1 text-xs select-none
               mix-blend-difference text-hover truncate"
            >
              {recordingProgress.status}
              {recordingProgress?.currentStep?.name ? `: ${ recordingProgress.currentStep.name }` : null}
            </span>
          </div>

          <span className="text-xs text-foreground">
            {Math.round( recordingProgress?.percentage )}%&nbsp;
          </span>
        </div>
      )}

      {( recordingProgress?.percentage === 100 || recordingProgress?.status === "completed" ) && jobId && (
        <button
          className="rounded-lg px-2 py-1 border border-theme text-foreground inline-block bg-background text-sm "
          onClick={async() => await fetchDownload( `/api/recordings/download/${ jobId }` )}
        >
          <SaveIcon className="inline align-middle mr-1 h-4"/>
          <span className="align-middle">Download</span>
        </button>
      )}
    </>
  );
}