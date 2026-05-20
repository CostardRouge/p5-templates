"use client";

import {
  useRouter
} from "next/navigation";
import React, {
  forwardRef, useImperativeHandle, useState
} from "react";
import fetchDownload from "@/utils/fetchDownload";
import VideoPreviewModal from "@/components/VideoPreviewModal";
import {
  useRecordingQueue
} from "@/hooks/useRecordingQueue";
import {
  getScopeAssetPath, resolveAssetURL
} from "@/p5/shared/utils";
import type {
  JobId, JobModel, JobStatusEnum, RecordingProgressionStream
} from "@/types/recording.types";
import type {
  SketchOptionInput, SlideOptionInput
} from "@/types/sketch.types";
import BrowserRecordingButton from "./components/BrowserRecordingButton";
import CompletedActions from "./components/CompletedActions";
import DraftActions from "./components/DraftActions";
import FailedActions from "./components/FailedActions";
import NoJobActions from "./components/NoJobActions";
import RecordingActions from "./components/RecordingActions";
import {
  useBrowserRecorder
} from "./hooks/useBrowserRecorder";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import type {
  RecorderCapabilities
} from "@/engines/recording";
import type {
  RecordingLifecycle
} from "../../hooks/useRecordingLifecycle";

export type CaptureActionsRef = {
  saveAsDraft: () => Promise<void>;
  cloneAsDraft: () => Promise<void>;
  isRecording: boolean;
  isSaving: boolean;
};

type CaptureActionsProps = {
  name: string;
  options: SketchOptionInput;
  persistedJob?: JobModel;
  activeSlideIndex: number | undefined;
  backendRecording: boolean;
  browserRecordingSupported: boolean;
  thumbnails?: Record<string, string>;
  lifecycle: RecordingLifecycle;
  recordingProgress: RecordingProgressionStream | null;
  subscribeToRecordingStatus: ( jobId: JobId ) => void;
};

const CaptureActions = forwardRef<CaptureActionsRef, CaptureActionsProps>( (
  {
    name,
    options,
    persistedJob,
    activeSlideIndex,
    backendRecording,
    browserRecordingSupported,
    thumbnails,
    lifecycle,
    recordingProgress,
    subscribeToRecordingStatus
  },
  ref
) => {
  const router = useRouter();
  const [
    {
      engineId, engine
    }
  ] = useSketch();

  const {
    state,
    currentStatus,
    effectiveJob,
    isRecording
  } = lifecycle;

  const recorderCapabilities: RecorderCapabilities | null = engine
    ? engine.getRecordingCapabilities(
      options as never,
      activeSlideIndex
    )
    : null;

  const browserRecorder = useBrowserRecorder( {
    engine,
    options: options as never,
    activeSlideIndex,
    sketchName: name
  } );
  const {
    enqueueRecording, isLoading
  } = useRecordingQueue();

  const [
    jobId,
    setJobId
  ] = useState<JobId | undefined>( persistedJob?.id );
  const [
    saving,
    setSaving
  ] = useState<boolean>( false );
  const [
    showPreviewModal,
    setShowPreviewModal
  ] = useState<boolean>( false );
  const [
    deleting,
    setDeleting
  ] = useState<boolean>( false );
  const [
    cancelling,
    setCancelling
  ] = useState<boolean>( false );
  const [
    retrying,
    setRetrying
  ] = useState<boolean>( false );
  const [
    downloading,
    setDownloading
  ] = useState<boolean>( false );
  const [
    cloning,
    setCloning
  ] = useState<boolean>( false );

  // Auto-subscribe to recording status on mount if job is active/queued
  React.useEffect(
    () => {
      if ( persistedJob && [
        "active",
        "queued"
      ].includes( persistedJob.status ) ) {
        subscribeToRecordingStatus( persistedJob.id );
      }
    },
    [
      persistedJob,
      persistedJob?.id,
      persistedJob?.status,
      subscribeToRecordingStatus
    ]
  );

  // Auto-open preview modal when recording completes successfully
  const prevStatusRef = React.useRef<JobStatusEnum | undefined>( currentStatus );

  React.useEffect(
    () => {
      const prevStatus = prevStatusRef.current;

      prevStatusRef.current = currentStatus;

      if (
        backendRecording &&
        currentStatus === "completed" &&
        prevStatus !== "completed"
      ) {
        setShowPreviewModal( true );
      }
    },
    [
      backendRecording,
      currentStatus
    ]
  );

  const handleSubmit = async(
    status: JobStatusEnum = "queued",
    persistedJobId?: JobId,
    skipRedirect = false
  ): Promise<JobId | null> => {
    if ( status === "draft" ) {
      setSaving( true );
    }

    try {
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
        window.location.pathname.replace(
          /^\//,
          ""
        )
      );
      formData.append(
        "options",
        JSON.stringify( options )
      );

      if ( thumbnails ) {
        formData.append(
          "thumbnails",
          JSON.stringify( thumbnails )
        );
      }

      // Handle GLOBAL assets
      const globalAssets = options.assets ?? {
        images: [],
        videos: []
      };

      for ( const type of Object.keys( globalAssets ) ) {
        const fileList = globalAssets[ type as keyof typeof globalAssets ] ?? [];

        await Promise.all( fileList.map( async(
          assetUrl: string, index: number
        ) => {
          const blob = await fetch( resolveAssetURL(
            assetUrl,
            options.id
          ) ).then( ( r ) => r.blob() );
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
      const slides: SlideOptionInput[] = options.slides || [];

      for ( let i = 0; i < slides.length; i++ ) {
        const slide = slides[ i ];
        const assets = slide.assets ?? {
          images: [],
          videos: []
        };

        for ( const type of Object.keys( assets ) ) {
          const fileList = assets[ type as keyof typeof assets ] ?? [];

          await Promise.all( fileList.map( async(
            assetUrl: string, index: number
          ) => {
            const blob = await fetch( resolveAssetURL(
              assetUrl,
              options.id
            ) ).then( ( r ) => r.blob() );
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
        console.log(
          `[CaptureActions] Successfully saved/enqueued job with ID: ${ newJobId }`,
          {
            status,
            skipRedirect,
            persistedJobId
          }
        );

        // Update state first
        setJobId( newJobId );

        if ( status !== "draft" ) {
          subscribeToRecordingStatus( newJobId );
        }

        // Redirect to URL with job ID for both drafts and recordings (unless skipRedirect is true)
        if ( !skipRedirect ) {
          const currentPath = window.location.pathname.replace(
            /\?.*$/,
            ""
          );
          const newUrl = `${ currentPath }?id=${ newJobId }`;

          console.log( `[CaptureActions] Updating URL to: ${ newUrl }` );
          // Use router.replace with error handling
          try {
            router.replace( newUrl );
            window.history.replaceState(
              null,
              "",
              newUrl
            );
          } catch( routerError ) {
            console.error(
              "[CaptureActions] Router.replace failed, falling back to window.history:",
              routerError
            );
            window.history.replaceState(
              null,
              "",
              newUrl
            );
          }
        }

        if ( status === "draft" ) {
          setSaving( false );
        }

        return newJobId;
      } else {
        console.error(
          "[CaptureActions] enqueueRecording returned null",
          {
            status,
            persistedJobId
          }
        );
        if ( status === "draft" ) {
          setSaving( false );
        }
        // Optionally show error to user
        alert( "Failed to save draft. Please try again." );

        return null;
      }
    } catch( error ) {
      console.error(
        "[CaptureActions] Error in handleSubmit:",
        error
      );
      if ( status === "draft" ) {
        setSaving( false );
      }
      // Show error to user
      alert( "An error occurred while saving. Please try again." );

      return null;
    }
  };

  const handleRecordAgain = async() => {
    setCloning( true );
    try {
      await handleSubmit( "draft" );
    } catch( error ) {
      console.error(
        "Failed to clone:",
        error
      );
      alert( "Failed to clone. Please try again." );
    } finally {
      setCloning( false );
    }
  };

  // Clone the current options into a new draft and open it in a new tab.
  // Keeps the recorded sketch visible in the original tab so the user can
  // compare or come back to it.
  const handleCloneAndOpen = async() => {
    setCloning( true );
    try {
      const newJobId = await handleSubmit(
        "draft",
        undefined,
        true // skip in-tab redirect — we open a new tab instead
      );

      if ( newJobId ) {
        const currentPath = window.location.pathname.replace(
          /\?.*$/,
          ""
        );
        const newUrl = `${ currentPath }?id=${ newJobId }`;

        window.open(
          newUrl,
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch( error ) {
      console.error(
        "Failed to clone:",
        error
      );
      alert( "Failed to clone. Please try again." );
    } finally {
      setCloning( false );
    }
  };

  // Expose imperative actions to parent via ref
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
      cloneAsDraft: handleCloneAndOpen,
      isSaving: saving,
      isRecording: !!isRecording
    } )
  );

  const handleDelete = async() => {
    const jobToDelete = persistedJob?.id || jobId;

    if ( !jobToDelete ) {
      return;
    }

    const statusText = persistedJob?.status || currentStatus || "recording";

    if (
      !confirm( `Delete this ${ statusText }? This action cannot be undone.` )
    ) {
      return;
    }

    setDeleting( true );

    try {
      const response = await fetch(
        `/api/recordings/${ jobToDelete }`,
        {
          method: "DELETE"
        }
      );

      if ( !response.ok ) {
        throw new Error( "Delete failed" );
      }

      const {
        deleted
      } = await response.json();

      if ( deleted ) {
        router.push( `/templates/${ engineId }/${ name }` );
      } else {
        alert( `Could not delete job: ${ jobToDelete }` );
        setDeleting( false );
      }
    } catch( error ) {
      alert( "Failed to delete. Please try again." );
      setDeleting( false );
    }
  };

  const handleCancel = async() => {
    if ( !jobId ) {
      return;
    }

    setCancelling( true );

    try {
      const response = await fetch(
        `/api/recordings/${ jobId }/cancel`,
        {
          method: "POST"
        }
      );

      if ( !response.ok ) {
        throw new Error( "Cancel failed" );
      }

      const {
        cancelled
      } = await response.json();

      if ( !cancelled ) {
        alert( `Could not cancel job: ${ jobId }` );
      }
    } catch( error ) {
      alert( "Failed to cancel. Please try again." );
    } finally {
      setCancelling( false );
    }
  };

  const handleRetry = async() => {
    if ( !persistedJob?.id ) {
      return;
    }

    setRetrying( true );

    try {
      const response = await fetch(
        `/api/recordings/${ persistedJob.id }/retry`,
        {
          method: "POST"
        }
      );

      if ( !response.ok ) {
        throw new Error( "Retry failed" );
      }

      const {
        retried
      } = await response.json();

      if ( retried ) {
        setJobId( persistedJob.id );
        subscribeToRecordingStatus( persistedJob.id );
      } else {
        alert( `Could not retry job: ${ persistedJob.id }` );
        setRetrying( false );
      }
    } catch( error ) {
      alert( "Failed to retry. Please try again." );
      setRetrying( false );
    }
  };

  const handleDownload = async() => {
    const jobToDownload = persistedJob?.id || jobId;

    if ( !jobToDownload || activeSlideIndex === undefined ) {
      return;
    }

    setDownloading( true );
    try {
      await fetchDownload( `/api/recordings/download/${ jobToDownload }/slide/${ activeSlideIndex }` );
    } catch( error ) {
      alert( "Failed to download. Please try again." );
    } finally {
      setDownloading( false );
    }
  };

  const isAnyActionLoading =
    isLoading ||
      saving ||
      deleting ||
      cancelling ||
      retrying ||
      downloading ||
      cloning;
  // Don't block start button when only saving (isLoading is true during save too)
  const isBlockingActionLoading =
    ( isLoading && !saving ) ||
      deleting ||
      cancelling ||
      retrying ||
      downloading ||
      cloning;

  const renderBackendActions = () => {
    switch ( state ) {
      case "no-job":
        return (
          <NoJobActions
            onSaveDraft={ () => handleSubmit( "draft" ) }
            onStart={ () => handleSubmit( "queued" ) }
            saving={ saving }
            isLoading={ isLoading }
            isAnyActionLoading={ isAnyActionLoading }
            isBlockingActionLoading={ isBlockingActionLoading }
          />
        );

      case "draft":
        if ( !persistedJob ) {
          return null;
        }
        return (
          <DraftActions
            onSave={ () => handleSubmit(
              "draft",
              persistedJob.id
            ) }
            onStart={ () => handleSubmit(
              "queued",
              persistedJob.id
            ) }
            onDelete={ handleDelete }
            saving={ saving }
            isLoading={ isLoading }
            deleting={ deleting }
            isAnyActionLoading={ isAnyActionLoading }
            isBlockingActionLoading={ isBlockingActionLoading }
          />
        );

      case "queued":
      case "active":
        return (
          <RecordingActions
            persistedJob={ persistedJob }
            jobId={ jobId }
            recordingProgress={ recordingProgress || undefined }
            onClone={ handleRecordAgain }
            onCancel={ handleCancel }
            cloning={ cloning }
            cancelling={ cancelling }
          />
        );

      case "completed":
        if ( !effectiveJob ) {
          return null;
        }
        return (
          <CompletedActions
            persistedJob={ effectiveJob }
            activeSlideIndex={ activeSlideIndex }
            onPreview={ () => setShowPreviewModal( true ) }
            onRecordAgain={ handleRecordAgain }
            onDelete={ handleDelete }
            downloading={ downloading }
            onDownload={ handleDownload }
            deleting={ deleting }
            cloning={ cloning }
          />
        );

      case "failed":
      case "cancelled":
        if ( !effectiveJob ) {
          return null;
        }
        return (
          <FailedActions
            onRetry={ handleRetry }
            onSaveAsDraft={ async() => {
              await handleSubmit(
                "draft",
                effectiveJob.id
              );
            } }
            onDelete={ handleDelete }
            retrying={ retrying }
            saving={ saving }
            deleting={ deleting }
            isAnyActionLoading={ isAnyActionLoading }
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1 glass px-2 py-2 border border-theme rounded-2xl shadow-lg">
        <div className="flex flex-col gap-1 h-auto w-full">
          {/* Browser Recording - Only on Compatible Devices */}
          {!isRecording && browserRecordingSupported && recorderCapabilities && (
            <BrowserRecordingButton
              capabilities={ recorderCapabilities }
              isRecording={ browserRecorder.isRecording }
              progress={ browserRecorder.progress }
              error={ browserRecorder.error }
              onStart={ browserRecorder.start }
              onStop={ browserRecorder.stop }
              onCancel={ browserRecorder.cancel }
            />
          )}

          {backendRecording && renderBackendActions()}
        </div>
      </div>

      {backendRecording && effectiveJob && showPreviewModal && (
        <VideoPreviewModal
          jobId={ effectiveJob.id }
          isOpen={ showPreviewModal }
          onClose={ () => setShowPreviewModal( false ) }
        />
      )}
    </>
  );
} );

CaptureActions.displayName = "CaptureActions";

export default CaptureActions;
