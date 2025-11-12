"use client";

import React, {
  forwardRef, useImperativeHandle, useState
} from "react";
import {
  useRouter
} from "next/navigation";
import {
  Archive, Clapperboard, Download, Eye, Loader, RotateCcw, Save, Trash2, X, Copy
} from "lucide-react";
import clsx from "clsx";

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
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import VideoPreviewModal from "@/components/VideoPreviewModal";

export type CaptureActionsRef = {
  saveAsDraft: () => Promise<void>;
  isSaving: boolean;
};

// Helper function to format file size
function formatFileSize( bytes: number ): string {
  if ( bytes === 0 ) return "0 B";
  const k = 1024;
  const sizes = [
    "B",
    "KB",
    "MB",
    "GB"
  ];
  const i = Math.floor( Math.log( bytes ) / Math.log( k ) );
  return `${ ( bytes / Math.pow( k, i ) ).toFixed( 1 ) } ${ sizes[ i ] }`;
}

// Completed actions component with file size display
function CompletedActions( {
  persistedJob,
  activeSlideIndex,
  onPreview,
  onRecordAgain,
  onDelete
}: {
  persistedJob: JobModel;
  activeSlideIndex: number;
  onPreview: () => void;
  onRecordAgain: () => void;
  onDelete: () => void;
} ) {
  // Get video sizes directly from job data
  const videoSizes = ( persistedJob.videoSizes as unknown as number[] ) || [];
  const currentVideoSize = videoSizes[ activeSlideIndex ];

  return (
    <div className="grid grid-cols-2 gap-1">
      <button
        className="rounded-lg px-2 py-1 border border-theme bg-hover/50 border-active text-foreground hover:bg-hover text-xs font-medium"
        onClick={onPreview}
      >
        <Eye className="mx-auto h-3" />
        <span className="align-middle">Preview</span>
      </button>

      <button
        className="rounded-lg px-2 py-1 border border-theme text-foreground bg-background hover:bg-hover text-xs"
        onClick={async() => await fetchDownload( `/api/recordings/download/${ persistedJob.id }/slide/${ activeSlideIndex }` )}
      >
        <Download className="mx-auto h-3" />
        <span className="align-middle">
          Download{currentVideoSize ? ` (${ formatFileSize( currentVideoSize ) })` : ""}
        </span>
      </button>

      <button
        className="rounded-lg px-2 py-1 border border-theme text-foreground bg-background hover:bg-hover text-xs"
        onClick={onRecordAgain}
      >
        <Copy className="mx-auto h-3" />
        <span className="align-middle">Clone</span>
      </button>

      <button
        className="rounded-lg px-2 py-1 border border-theme text-red-600 hover:bg-red-50 text-xs"
        onClick={onDelete}
      >
        <Trash2 className="mx-auto h-3" />
        <span className="align-middle">Delete</span>
      </button>
    </div>
  );
}

const CaptureActions = forwardRef<CaptureActionsRef, {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  activeSlideIndex: number;
}>( (
  {
    name,
    options,
    persistedJob,
    activeSlideIndex
  }, ref
) => {
  const router = useRouter();
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
    showPreviewModal,
    setShowPreviewModal
  ] = useState<boolean>( false );

  const {
    backendRecording
  } = useSketch();

  const {
    subscribeToRecordingStatus, recordingProgress
  } = useRecordingStatusStream();

  // Pause P5 sketch during recording
  React.useEffect(
    () => {
      const isRecording = recordingProgress && [
        "queued",
        "active"
      ].includes( recordingProgress.status );

     if ( isRecording ) {
        // Pause the sketch
        if ( typeof ( window as any ).noLoop === "function" ) {
          ( window as any ).noLoop();
        }
      } else {
        // Resume when not recording
        if ( typeof ( window as any ).loop === "function" ) {
          ( window as any ).loop();
        }
      }
    },
    [
      recordingProgress
    ]
  );

  const handleSubmit = async(
    status: JobStatusEnum = "queued",
    persistedJobId?: JobId,
    skipRedirect = false
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
      if ( status !== "draft" ) {
        setJobId( newJobId );
        subscribeToRecordingStatus( newJobId );
      }

      if ( status === "draft" && !skipRedirect ) {
        router.replace( `${ name }?id=${ newJobId }` );
        setSaving( false );
      } else if ( status === "draft" ) {
        // Reset saving state after successful auto-save
        setSaving( false );
      }
    } else if ( status === "draft" ) {
      setSaving( false );
    }
  };

  // Expose save function to parent via ref
  useImperativeHandle(
    ref,
    () => ( {
      saveAsDraft: async() => {
        await handleSubmit(
          "draft",
          persistedJob?.id,
          true // skip redirect for auto-save
        );
      },
      isSaving: saving,
    } )
  );

  const handleDelete = async() => {
    if ( !persistedJob?.id ) return;

    if ( !confirm( `Delete this ${ persistedJob.status }? This action cannot be undone.` ) ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/recordings/${ persistedJob.id }`,
        {
          method: "DELETE"
        }
      );

      if ( !response.ok ) throw new Error( "Delete failed" );

      const {
        deleted
      } = await response.json();

      if ( deleted ) {
        router.push( `/templates/p5/${ name }` );
      } else {
        alert( `Could not delete job: ${ persistedJob.id }` );
      }
    } catch ( error ) {
      console.error(
        "Delete failed:",
        error
      );
      alert( "Failed to delete. Please try again." );
    }
  };

  const handleCancel = async() => {
    if ( !jobId ) return;

    try {
      const response = await fetch(
        `/api/recordings/${ jobId }/cancel`,
        {
          method: "POST"
        }
      );

      if ( !response.ok ) throw new Error( "Cancel failed" );

      const {
        cancelled
      } = await response.json();

      if ( !cancelled ) {
        alert( `Could not cancel job: ${ jobId }` );
      }
    } catch ( error ) {
      console.error(
        "Cancel failed:",
        error
      );
      alert( "Failed to cancel. Please try again." );
    }
  };

  const handleRetry = async() => {
    if ( !persistedJob?.id ) return;

    try {
      const response = await fetch(
        `/api/recordings/${ persistedJob.id }/retry`,
        {
          method: "POST"
        }
      );

      if ( !response.ok ) throw new Error( "Retry failed" );

      const {
        retried
      } = await response.json();

      if ( retried ) {
        setJobId( persistedJob.id );
        subscribeToRecordingStatus( persistedJob.id );
      } else {
        alert( `Could not retry job: ${ persistedJob.id }` );
      }
    } catch ( error ) {
      console.error(
        "Retry failed:",
        error
      );
      alert( "Failed to retry. Please try again." );
    }
  };

  const handleRecordAgain = async() => {
    // Create a new draft from current options
    await handleSubmit( "draft" );
  };

  console.log({activeSlideIndex})

  // Determine current status
  const currentStatus = recordingProgress?.status || persistedJob?.status;
  const isRecording = recordingProgress && [
    "queued",
    "active"
  ].includes( recordingProgress.status );
  const isCompleted = currentStatus === "completed";
  const isFailed = [
    "failed",
    "cancelled"
  ].includes( currentStatus || "" );
  const isDraft = currentStatus === "draft";
  const hasNoJob = !persistedJob && !recordingProgress;

  return (
    <>
      <div className="flex flex-col gap-1 h-auto w-full">
        {/* Browser Recording - Always Available */}
        {!isRecording && (
         <>
          <span className="h-[1px] w-[50%] mx-auto border-t border-hover" />

          <button
            className="rounded-lg px-2 py-1 border border-theme text-foreground bg-background hover:bg-hover text-xs"
            onClick={async() => {
              await window?.startLoopRecording( {
                format: "webm"
              } );
            }}
          >
            <Save className="inline h-3" />
            <span className="align-middle">Browser recording in .webm</span>
          </button>

          <span className="h-[1px] w-[50%] mx-auto border-t border-hover" />
         </>
        )}

        {backendRecording && (
          <>
            {/* NO JOB - Fresh Start */}
            {hasNoJob && (
              <div className="flex gap-1">
                <button
                  className="rounded-lg px-2 py-1 border border-theme text-foreground bg-background hover:bg-hover disabled:opacity-50 text-xs"
                  onClick={() => handleSubmit( "draft" )}
                  disabled={isLoading || saving}
                >
                  {saving ? <Loader className="inline h-3 animate-spin"/> :
                    <Archive className="inline h-3" />}
                  <span className="align-middle">Save as Draft</span>
                </button>

                <button
                  className="rounded-lg px-2 py-1 border border-theme bg-hover/50 border-active text-foreground hover:bg-hover disabled:opacity-50 text-xs font-medium"
                  onClick={() => handleSubmit( "queued" )}
                  disabled={isLoading || saving}
                >
                  {isLoading ? <Loader className="inline h-3 animate-spin"/> :
                    <Clapperboard className="inline h-3" />}
                  <span className="align-middle">Start Recording</span>
                </button>
              </div>
            )}

            {/* DRAFT Status */}
            {isDraft && !isRecording && persistedJob && (
              <>
                <div className="flex gap-1">
                  <button
                    className={clsx(
                      "rounded-lg px-2 py-1 border border-theme text-foreground bg-background hover:bg-hover disabled:opacity-50 text-xs flex-1",
                      {
                        "animate-pulse-soft": saving
                      }
                    )}
                    onClick={() => handleSubmit(
                      "draft",
                      persistedJob.id
                    )}
                    disabled={isLoading || saving}
                  >
                    {saving ? <Loader className="inline h-3 animate-spin"/> :
                      <Save className="inline h-3"/>}
                    <span className="align-middle">Save</span>
                  </button>

                  <button
                    className="rounded-lg px-2 py-1 border border-theme bg-hover/50 border-active text-foreground hover:bg-hover disabled:opacity-50 text-xs flex-1 font-medium"
                    onClick={() => handleSubmit(
                      "queued",
                      persistedJob.id
                    )}
                    disabled={isLoading || saving}
                  >
                    {isLoading && !saving ? <Loader className="inline h-3 animate-spin"/> :
                      <Clapperboard className="inline h-3" />}
                    <span className="align-middle">Start Recording</span>
                  </button>
                </div>

                <button
                  className="rounded-lg px-2 py-1 border border-theme text-red-600 hover:bg-red-50 disabled:opacity-50 text-xs"
                  onClick={handleDelete}
                  disabled={isLoading || saving}
                >
                  <Trash2 className="inline h-3" />
                  <span className="align-middle">Delete Draft</span>
                </button>
              </>
            )}

            {/* RECORDING Status (Queued/Active) */}
            {isRecording && (
              <>
                <span className="h-[1px] w-[50%] mx-auto border-t border-hover" />

                <div className="flex flex justify-start bg-background text-center items-center gap-1">
                  
                   <span className="text-xs text-foreground">
                    {Math.round( recordingProgress?.percentage )}%
                  </span>

                  <div
                    className={`w-full h-6 rounded-lg relative ring-1 overflow-hidden ${
                      recordingProgress.status !== "failed" ? "ring-gray-300" : "ring-red-400"
                    }`}
                  >
                    <div className="absolute inset-0 rounded-xl bg-background" />

                    <div
                      className="absolute inset-y-0 left-0 bg-hover border-active"
                      style={{
                        width: `${ recordingProgress.percentage }%`
                      }}
                    />

                    <span
                      className="absolute inset-0 p-1 text-xs select-none text-foreground truncate"
                    >
                      {recordingProgress.status}
                      {recordingProgress?.currentStep?.name ? `: ${ recordingProgress.currentStep.name }` : null}
                    </span>
                  </div>
                </div>

                 <button
                  className="rounded-lg px-2 py-1 border border-theme text-red-600 hover:bg-red-50 text-xs"
                  onClick={handleCancel}
                >
                  <X className="inline h-3" />
                  <span className="align-middle">Cancel recording</span>
                </button>
              </>
            )}

            {/* COMPLETED Status */}
            {isCompleted && persistedJob && (
              <CompletedActions
                persistedJob={persistedJob}
                activeSlideIndex={activeSlideIndex}
                onPreview={() => setShowPreviewModal( true )}
                onRecordAgain={handleRecordAgain}
                onDelete={handleDelete}
              />
            )}

            {/* FAILED/CANCELLED Status */}
            {isFailed && persistedJob && (
              <>
                <button
                  className="rounded-lg px-2 py-1 border border-theme bg-hover/50 border-active text-foreground hover:bg-hover text-xs font-medium"
                  onClick={handleRetry}
                >
                  <RotateCcw className="inline h-3" />
                  <span className="align-middle">Retry</span>
                </button>

                <button
                  className="rounded-lg px-2 py-1 border border-theme text-foreground bg-background hover:bg-hover text-xs"
                  onClick={async() => {
                    await handleSubmit(
                      "draft",
                      persistedJob.id
                    );
                  }}
                >
                  <Archive className="inline h-3" />
                  <span className="align-middle">Edit & Save as Draft</span>
                </button>

                <button
                  className="rounded-lg px-2 py-1 border border-theme text-red-600 hover:bg-red-50 text-xs"
                  onClick={handleDelete}
                >
                  <Trash2 className="inline h-3" />
                  <span className="align-middle">Delete</span>
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Preview Modal */}
      {showPreviewModal && persistedJob && (
        <VideoPreviewModal
          jobId={persistedJob.id}
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal( false )}
        />
      )}
    </>
  );
} );

CaptureActions.displayName = "CaptureActions";

export default CaptureActions;