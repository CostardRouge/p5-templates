"use client";

import React, { forwardRef, useImperativeHandle, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownFromLine } from "lucide-react";

import { useRecordingQueue } from "@/hooks/useRecordingQueue";
import useRecordingStatusStream from "@/hooks/useRecordingStatusStream";
import { JobId, JobModel, JobStatusEnum } from "@/types/recording.types";
import fetchDownload from "@/components/utils/fetchDownload";
import { getScopeAssetPath, resolveAssetURL } from "@/p5-sketches/shared/utils";
import { SketchOption, SlideOption } from "@/types/sketch.types";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import VideoPreviewModal from "@/components/VideoPreviewModal";
import CollapsibleItem from "@/components/CollapsibleItem";

import { getRecordingStatus } from "./utils/getRecordingStatus";
import { checkBrowserRecordingSupport } from "./utils/checkBrowserRecordingSupport";
import BrowserRecordingButton from "./components/BrowserRecordingButton";
import NoJobActions from "./components/NoJobActions";
import DraftActions from "./components/DraftActions";
import RecordingActions from "./components/RecordingActions";
import CompletedActions from "./components/CompletedActions";
import FailedActions from "./components/FailedActions";

export type CaptureActionsRef = {
  saveAsDraft: () => Promise<void>;
  isSaving: boolean;
};

type CaptureActionsProps = {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  activeSlideIndex: number;
};

const CaptureActions = forwardRef<CaptureActionsRef, CaptureActionsProps>(
  ({ name, options, persistedJob, activeSlideIndex }, ref) => {
    const router = useRouter();
    const { enqueueRecording, isLoading } = useRecordingQueue();

    const [jobId, setJobId] = useState<JobId | undefined>(persistedJob?.id);
    const [saving, setSaving] = useState<boolean>(false);
    const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [cancelling, setCancelling] = useState<boolean>(false);
    const [retrying, setRetrying] = useState<boolean>(false);
    const [downloading, setDownloading] = useState<boolean>(false);
    const [cloning, setCloning] = useState<boolean>(false);

    const { backendRecording } = useSketch();

    // Check if browser supports MediaRecorder for browser recording
    const [isBrowserRecordingSupported, setIsBrowserRecordingSupported] =
      useState<boolean>(false);

    React.useEffect(() => {
      setIsBrowserRecordingSupported(checkBrowserRecordingSupport());
    }, []);

    const { subscribeToRecordingStatus, recordingProgress } =
      useRecordingStatusStream();

    // Determine current status
    const currentStatus = (recordingProgress?.status || persistedJob?.status) as JobStatusEnum | undefined;

    // Auto-subscribe to recording status on mount if job is active/queued
    React.useEffect(() => {
      if (persistedJob && ["active", "queued"].includes(persistedJob.status)) {
        subscribeToRecordingStatus(persistedJob.id);
      }
    }, [persistedJob?.id, persistedJob?.status, subscribeToRecordingStatus]);

    // Pause P5 sketch during recording
    React.useEffect(() => {
      const isRecording =
        recordingProgress && ["queued", "active"].includes(recordingProgress.status);

      if (isRecording) {
        // Pause the sketch
        if (typeof (window as any).noLoop === "function") {
          (window as any).noLoop();
        }
      } else {
        // Resume when not recording
        if (typeof (window as any).loop === "function") {
          (window as any).loop();
        }
      }
    }, [recordingProgress]);

    const handleSubmit = async (
      status: JobStatusEnum = "queued",
      persistedJobId?: JobId,
      skipRedirect = false
    ) => {
      if (status === "draft") {
        setSaving(true);
      }

      const formData = new FormData();

      if (persistedJobId) {
        formData.append("jobId", persistedJobId);
      }

      formData.append("status", status);
      formData.append("template", `p5/${name}`);
      formData.append("options", JSON.stringify(options));

      // Handle GLOBAL assets
      const globalAssets = options.assets || {};

      for (const type of Object.keys(globalAssets)) {
        const fileList = globalAssets[type as keyof typeof globalAssets] || [];

        await Promise.all(
          fileList.map(async (assetUrl: string, index: number) => {
            const blob = await fetch(
              resolveAssetURL(assetUrl, options.id)
            ).then((r) => r.blob());
            const name = assetUrl.split("/").pop() ?? `${type}-${index}`;

            formData.append(
              `file[global][${type}]`,
              new File([blob], `global/${type}/${name}`, {
                type: blob.type,
              })
            );
          })
        );
      }

      // Handle SLIDE assets
      const slides: SlideOption[] = options.slides || [];

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const assets = slide.assets || {};

        for (const type of Object.keys(assets)) {
          const fileList = assets[type as keyof typeof assets] || [];

          await Promise.all(
            fileList.map(async (assetUrl: string, index: number) => {
              const blob = await fetch(
                resolveAssetURL(assetUrl, options.id)
              ).then((r) => r.blob());
              const prefix = `slide-${i}-${type}-${index}`;
              const name = assetUrl.split("/").pop() ?? prefix;

              formData.append(
                `file[slide-${i}][${type}]`,
                new File(
                  [blob],
                  getScopeAssetPath(name, type, {
                    slide: i,
                  }),
                  {
                    type: blob.type,
                  }
                )
              );
            })
          );
        }
      }

      const newJobId = await enqueueRecording(formData);

      if (newJobId !== null) {
        setJobId(newJobId);

        if (status !== "draft") {
          subscribeToRecordingStatus(newJobId);
        }

        // Redirect to URL with job ID for both drafts and recordings (unless skipRedirect is true)
        if (!skipRedirect) {
          router.replace(`${name}?id=${newJobId}`);
        }

        if (status === "draft") {
          setSaving(false);
        }
      } else if (status === "draft") {
        setSaving(false);
      }
    };

    // Expose save function to parent via ref
    useImperativeHandle(ref, () => ({
      saveAsDraft: async () => {
        await handleSubmit(
          "draft",
          persistedJob?.id,
          true // skip redirect for auto-save
        );
      },
      isSaving: saving,
    }));

    const handleDelete = async () => {
      const jobToDelete = persistedJob?.id || jobId;

      if (!jobToDelete) return;

      const statusText = persistedJob?.status || currentStatus || "recording";

      if (
        !confirm(`Delete this ${statusText}? This action cannot be undone.`)
      ) {
        return;
      }

      setDeleting(true);

      try {
        const response = await fetch(`/api/recordings/${jobToDelete}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Delete failed");

        const { deleted } = await response.json();

        if (deleted) {
          router.push(`/templates/p5/${name}`);
        } else {
          alert(`Could not delete job: ${jobToDelete}`);
          setDeleting(false);
        }
      } catch (error) {
        alert("Failed to delete. Please try again.");
        setDeleting(false);
      }
    };

    const handleCancel = async () => {
      if (!jobId) return;

      setCancelling(true);

      try {
        const response = await fetch(`/api/recordings/${jobId}/cancel`, {
          method: "POST",
        });

        if (!response.ok) throw new Error("Cancel failed");

        const { cancelled } = await response.json();

        if (!cancelled) {
          alert(`Could not cancel job: ${jobId}`);
        }
      } catch (error) {
        alert("Failed to cancel. Please try again.");
      } finally {
        setCancelling(false);
      }
    };

    const handleRetry = async () => {
      if (!persistedJob?.id) return;

      setRetrying(true);

      try {
        const response = await fetch(`/api/recordings/${persistedJob.id}/retry`, {
          method: "POST",
        });

        if (!response.ok) throw new Error("Retry failed");

        const { retried } = await response.json();

        if (retried) {
          setJobId(persistedJob.id);
          subscribeToRecordingStatus(persistedJob.id);
        } else {
          alert(`Could not retry job: ${persistedJob.id}`);
          setRetrying(false);
        }
      } catch (error) {
        alert("Failed to retry. Please try again.");
        setRetrying(false);
      }
    };

    const handleRecordAgain = async () => {
      setCloning(true);
      try {
        await handleSubmit("draft");
      } catch (error) {
        console.error("Failed to clone:", error);
        alert("Failed to clone. Please try again.");
      } finally {
        setCloning(false);
      }
    };

    const handleDownload = async () => {
      const jobToDownload = persistedJob?.id || jobId;

      if (!jobToDownload) return;

      setDownloading(true);
      try {
        await fetchDownload(
          `/api/recordings/download/${jobToDownload}/slide/${activeSlideIndex}`
        );
      } catch (error) {
        alert("Failed to download. Please try again.");
      } finally {
        setDownloading(false);
      }
    };

    const handleBrowserRecord = async () => {
      await window?.startLoopRecording({
        format: "webm",
      });
    };

    // Determine UI states
    const { isRecording, isCompleted, isFailed, isDraft } =
      getRecordingStatus(currentStatus);
    const hasNoJob = !persistedJob && !recordingProgress && !jobId;
    const isAnyActionLoading =
      isLoading ||
      saving ||
      deleting ||
      cancelling ||
      retrying ||
      downloading ||
      cloning;
    const isBlockingActionLoading =
      isLoading || deleting || cancelling || retrying || downloading || cloning;

    // Use persistedJob or construct a minimal job object from recordingProgress/jobId
    const effectiveJob =
      persistedJob ||
      (jobId
        ? ({
            id: jobId,
            status: currentStatus || "queued",
            progress: recordingProgress?.percentage || 0,
          } as JobModel)
        : undefined);

    return (
      <>
        <div
          data-no-zoom=""
          className="flex flex-col gap-1 glass px-2 py-2 border border-theme rounded-2xl shadow-lg"
        >
          <div className="flex flex-col gap-1 h-auto w-full">
            {/* Browser Recording - Only on Compatible Devices */}
            {!isRecording && isBrowserRecordingSupported && (
              <BrowserRecordingButton onRecord={handleBrowserRecord} />
            )}

            {backendRecording && (
              <>
                {/* NO JOB - Fresh Start */}
                {hasNoJob && (
                  <NoJobActions
                    onSaveDraft={() => handleSubmit("draft")}
                    onStart={() => handleSubmit("queued")}
                    saving={saving}
                    isLoading={isLoading}
                    isAnyActionLoading={isAnyActionLoading}
                    isBlockingActionLoading={isBlockingActionLoading}
                  />
                )}

                {/* DRAFT Status */}
                {isDraft && !isRecording && persistedJob && (
                  <DraftActions
                    onSave={() => handleSubmit("draft", persistedJob.id)}
                    onStart={() => handleSubmit("queued", persistedJob.id)}
                    onDelete={handleDelete}
                    saving={saving}
                    isLoading={isLoading}
                    deleting={deleting}
                    isAnyActionLoading={isAnyActionLoading}
                    isBlockingActionLoading={isBlockingActionLoading}
                  />
                )}

                {/* RECORDING Status (Queued/Active) */}
                {isRecording && (
                  <RecordingActions
                    persistedJob={persistedJob}
                    jobId={jobId}
                    recordingProgress={recordingProgress || undefined}
                    onClone={handleRecordAgain}
                    onCancel={handleCancel}
                    cloning={cloning}
                    cancelling={cancelling}
                  />
                )}

                {/* COMPLETED Status */}
                {isCompleted && effectiveJob && (
                  <CompletedActions
                    persistedJob={effectiveJob}
                    activeSlideIndex={activeSlideIndex}
                    onPreview={() => setShowPreviewModal(true)}
                    onRecordAgain={handleRecordAgain}
                    onDelete={handleDelete}
                    downloading={downloading}
                    onDownload={handleDownload}
                    deleting={deleting}
                    cloning={cloning}
                  />
                )}

                {/* FAILED/CANCELLED Status */}
                {isFailed && effectiveJob && (
                  <FailedActions
                    onRetry={handleRetry}
                    onSaveAsDraft={async () => {
                      await handleSubmit("draft", effectiveJob.id);
                    }}
                    onDelete={handleDelete}
                    retrying={retrying}
                    saving={saving}
                    deleting={deleting}
                    isAnyActionLoading={isAnyActionLoading}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Preview Modal */}
        {showPreviewModal && effectiveJob && (
          <VideoPreviewModal
            jobId={effectiveJob.id}
            isOpen={showPreviewModal}
            onClose={() => setShowPreviewModal(false)}
          />
        )}
      </>
    );
  }
);

CaptureActions.displayName = "CaptureActions";

export default CaptureActions;
