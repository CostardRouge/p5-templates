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
import CompactProgressBar from "@/components/CompactProgressBar";
import {
  getRecordingSteps
} from "@/utils/recordingSteps";
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
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = [
    "B",
    "KB",
    "MB",
    "GB"
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(
    k,
    i
  )).toFixed(1)} ${sizes[i]}`;
}

// Completed actions component with file size display
function CompletedActions({
  persistedJob,
  activeSlideIndex,
  onPreview,
  onRecordAgain,
  onDelete,
  downloading,
  onDownload,
  deleting,
  cloning
}: {
  persistedJob: JobModel;
  activeSlideIndex: number;
  onPreview: () => void;
  onRecordAgain: () => void;
  onDelete: () => void;
  downloading: boolean;
  onDownload: () => Promise<void>;
  deleting: boolean;
  cloning: boolean;
}) {
  // Get video sizes directly from job data
  const videoSizes = (persistedJob.videoSizes as unknown as number[]) || [
  ];
  const currentVideoSize = videoSizes[activeSlideIndex];

  return (
    <div className="grid grid-cols-2 gap-1">
      <button
        className="rounded-xl px-3 py-2.5 border border-border bg-hover hover:bg-hover/70 text-foreground text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
        onClick={onPreview}
        disabled={downloading || deleting || cloning}
      >
        <Eye className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">Preview</span>
      </button>

      <button
        className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5 min-w-0"
        onClick={onDownload}
        disabled={downloading || deleting || cloning}
      >
        {downloading ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> : <Download className="h-4 w-4 flex-shrink-0" />}
        <span className="truncate">
          {downloading ? "Downloading..." : `Download${currentVideoSize ? ` (${formatFileSize(currentVideoSize)})` : ""}`}
        </span>
      </button>

      <button
        className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
        onClick={onRecordAgain}
        disabled={downloading || deleting || cloning}
      >
        {cloning ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> : <Copy className="h-4 w-4 flex-shrink-0" />}
        <span className="truncate">{cloning ? "Cloning..." : "Clone"}</span>
      </button>

      <button
        className="rounded-xl px-3 py-2.5 border border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
        onClick={onDelete}
        disabled={downloading || deleting || cloning}
      >
        {deleting ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> : <Trash2 className="h-4 w-4 flex-shrink-0" />}
        <span className="truncate">{deleting ? "Deleting..." : "Delete"}</span>
      </button>
    </div>
  );
}

const CaptureActions = forwardRef<CaptureActionsRef, {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  activeSlideIndex: number;
}>((
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
  ] = useState<JobId | undefined>(persistedJob?.id);

  const [
    saving,
    setSaving
  ] = useState<boolean>(false);

  const [
    showPreviewModal,
    setShowPreviewModal
  ] = useState<boolean>(false);

  const [
    deleting,
    setDeleting
  ] = useState<boolean>(false);

  const [
    cancelling,
    setCancelling
  ] = useState<boolean>(false);

  const [
    retrying,
    setRetrying
  ] = useState<boolean>(false);

  const [
    downloading,
    setDownloading
  ] = useState<boolean>(false);

  const {
    backendRecording
  } = useSketch();

  // Check if browser supports MediaRecorder for browser recording
  const [
    isBrowserRecordingSupported,
    setIsBrowserRecordingSupported
  ] = useState<boolean>(false);

  React.useEffect(
    () => {
      // Check if MediaRecorder is available, canvas.captureStream is supported, and WebM/VP8/VP9 is supported
      const hasMediaRecorder = typeof MediaRecorder !== "undefined";
      const hasCaptureStream = typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;

      // Check if any WebM codec is supported (VP8, VP9, or H264 in WebM container)
      const webmCodecs = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm;codecs=h264",
        "video/webm"
      ];

      const hasWebMSupport = hasMediaRecorder && webmCodecs.some(codec => {
        try {
          return MediaRecorder.isTypeSupported(codec);
        } catch {
          return false;
        }
      });

      // Check if device is iOS (iPhone, iPad, iPod)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      const isSupported = hasMediaRecorder && hasCaptureStream && hasWebMSupport && !isIOS;

      setIsBrowserRecordingSupported(isSupported);
    },
    [
    ]
  );

  const {
    subscribeToRecordingStatus, recordingProgress
  } = useRecordingStatusStream();

  // Determine current status (needed by handlers)
  const currentStatus = recordingProgress?.status || persistedJob?.status;

  // Auto-subscribe to recording status on mount if job is active/queued
  React.useEffect(
    () => {
      if (persistedJob && [
        "active",
        "queued"
      ].includes(persistedJob.status)) {
        subscribeToRecordingStatus(persistedJob.id);
      }
    },
    [
      persistedJob?.id,
      persistedJob?.status,
      subscribeToRecordingStatus
    ]
  );

  // Pause P5 sketch during recording
  React.useEffect(
    () => {
      const isRecording = recordingProgress && [
        "queued",
        "active"
      ].includes(recordingProgress.status);

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
    },
    [
      recordingProgress
    ]
  );

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
      `p5/${name}`
    );
    formData.append(
      "options",
      JSON.stringify(options)
    );

    // Handle GLOBAL assets
    const globalAssets = options.assets || {
    };

    for (const type of Object.keys(globalAssets)) {
      const fileList = globalAssets[type as keyof typeof globalAssets] || [
      ];

      await Promise.all(fileList.map(async (
        assetUrl: string, index: number
      ) => {
        const blob = await fetch(resolveAssetURL(
          assetUrl,
          options.id
        )).then(r => r.blob());
        const name = assetUrl.split("/").pop() ?? `${type}-${index}`;

        formData.append(
          `file[global][${type}]`,
          new File(
            [
              blob
            ],
            `global/${type}/${name}`,
            {
              type: blob.type
            }
          )
        );
      }));
    }

    // Handle SLIDE assets
    const slides: SlideOption[] = options.slides || [
    ];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const assets = slide.assets || {
      };

      for (const type of Object.keys(assets)) {
        const fileList = assets[type as keyof typeof assets] || [
        ];

        await Promise.all(fileList.map(async (
          assetUrl: string, index: number
        ) => {
          const blob = await fetch(resolveAssetURL(
            assetUrl,
            options.id
          )).then(r => r.blob());
          const prefix = `slide-${i}-${type}-${index}`;
          const name = assetUrl.split("/").pop() ?? prefix;

          formData.append(
            `file[slide-${i}][${type}]`,
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
        }));
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
  useImperativeHandle(
    ref,
    () => ({
      saveAsDraft: async () => {
        await handleSubmit(
          "draft",
          persistedJob?.id,
          true // skip redirect for auto-save
        );
      },
      isSaving: saving,
    })
  );

  const handleDelete = async () => {
    const jobToDelete = persistedJob?.id || jobId;

    if (!jobToDelete) return;

    const statusText = persistedJob?.status || currentStatus || "recording";

    if (!confirm(`Delete this ${statusText}? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/recordings/${jobToDelete}`,
        {
          method: "DELETE"
        }
      );

      if (!response.ok) throw new Error("Delete failed");

      const {
        deleted
      } = await response.json();

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
      const response = await fetch(
        `/api/recordings/${jobId}/cancel`,
        {
          method: "POST"
        }
      );

      if (!response.ok) throw new Error("Cancel failed");

      const {
        cancelled
      } = await response.json();

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
      const response = await fetch(
        `/api/recordings/${persistedJob.id}/retry`,
        {
          method: "POST"
        }
      );

      if (!response.ok) throw new Error("Retry failed");

      const {
        retried
      } = await response.json();

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

  const [
    cloning,
    setCloning
  ] = useState<boolean>(false);

  const handleRecordAgain = async () => {
    setCloning(true);
    try {
      await handleSubmit("draft");
    } catch (error) {
      console.error(
        "Failed to clone:",
        error
      );
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
      await fetchDownload(`/api/recordings/download/${jobToDownload}/slide/${activeSlideIndex}`);
    } catch (error) {
      alert("Failed to download. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  // Determine UI states
  const isRecording = currentStatus && [
    "queued",
    "active"
  ].includes(currentStatus);
  const isCompleted = currentStatus === "completed";
  const isFailed = [
    "failed",
    "cancelled"
  ].includes(currentStatus || "");
  const isDraft = currentStatus === "draft";
  const hasNoJob = !persistedJob && !recordingProgress && !jobId;
  const isAnyActionLoading = isLoading || saving || deleting || cancelling || retrying || downloading || cloning;
  const isBlockingActionLoading = isLoading || deleting || cancelling || retrying || downloading || cloning;

  // Use persistedJob or construct a minimal job object from recordingProgress/jobId
  const effectiveJob = persistedJob || (jobId ? {
    id: jobId,
    status: currentStatus || "queued",
    progress: recordingProgress?.percentage || 0,
  } as JobModel : undefined);

  return (
    <>
      <div className="flex flex-col gap-1 h-auto w-full">
        {/* Browser Recording - Only on Compatible Devices */}
        {!isRecording && isBrowserRecordingSupported && (
          <>
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-theme"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background rounded-md border border-theme px-2 text-foreground/50">render options</span>
              </div>
            </div>

            <button
              className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5"
              onClick={async () => {
                await window?.startLoopRecording({
                  format: "webm"
                });
              }}
            >
              <Save className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Record in .webm</span>
            </button>
          </>
        )}

        {backendRecording && (
          <>
            {/* NO JOB - Fresh Start */}
            {hasNoJob && (
              <div className="flex gap-1">
                <button
                  className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 flex-1"
                  onClick={() => handleSubmit("draft")}
                  disabled={isAnyActionLoading}
                >
                  {saving ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> :
                    <Archive className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{saving ? "Saving..." : "Save Draft"}</span>
                </button>

                <button
                  className="rounded-xl px-3 py-2.5 border border-border bg-hover hover:bg-hover/70 text-foreground disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 flex-1"
                  onClick={() => handleSubmit("queued")}
                  disabled={isBlockingActionLoading}
                >
                  {isLoading && !saving ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> :
                    <Clapperboard className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{isLoading && !saving ? "Starting..." : "Start"}</span>
                </button>
              </div>
            )}

            {/* DRAFT Status */}
            {isDraft && !isRecording && persistedJob && (
              <>
                <div className="flex gap-1">
                  <button
                    className={clsx(
                      "rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 flex-1",
                      {
                        "animate-pulse-soft": saving
                      }
                    )}
                    onClick={() => handleSubmit(
                      "draft",
                      persistedJob.id
                    )}
                    disabled={isAnyActionLoading}
                  >
                    {saving ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> :
                      <Save className="h-4 w-4 flex-shrink-0" />}
                    <span className="truncate">{saving ? "Saving..." : "Save"}</span>
                  </button>

                  <button
                    className="rounded-xl px-3 py-2.5 border border-border bg-hover hover:bg-hover/70 text-foreground disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 flex-1"
                    onClick={() => handleSubmit(
                      "queued",
                      persistedJob.id
                    )}
                    disabled={isBlockingActionLoading}
                  >
                    {isLoading && !saving ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> :
                      <Clapperboard className="h-4 w-4 flex-shrink-0" />}
                    <span className="truncate">{isLoading && !saving ? "Starting..." : "Start"}</span>
                  </button>
                </div>

                <button
                  className="rounded-xl px-3 py-2.5 border border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5"
                  onClick={handleDelete}
                  disabled={isAnyActionLoading}
                >
                  {deleting ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> : <Trash2 className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{deleting ? "Deleting..." : "Delete Draft"}</span>
                </button>
              </>
            )}

            {/* RECORDING Status (Queued/Active) */}
            {isRecording && (
              <>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                </div>

                {/* Compact Progress Bar with Steps */}
                <div className="px-1">
                  <CompactProgressBar
                    job={{
                      ...persistedJob,
                      id: persistedJob?.id || jobId || "",
                      progress: recordingProgress?.percentage || persistedJob?.progress || 0,
                      status: recordingProgress?.status || persistedJob?.status || "queued",
                    } as JobModel}
                    steps={(recordingProgress?.status || persistedJob?.status) === "active" ? getRecordingSteps({
                      ...persistedJob,
                      id: persistedJob?.id || jobId || "",
                      progress: recordingProgress?.percentage || persistedJob?.progress || 0,
                      status: recordingProgress?.status || persistedJob?.status || "active",
                    } as JobModel) : [
                    ]}
                    startTime={jobId && recordingProgress?.recordingDuration ? Date.now() - recordingProgress.recordingDuration : undefined}
                  />
                </div>

                <div className="flex gap-1">
                  <button
                    className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5 flex-1"
                    onClick={handleRecordAgain}
                    disabled={cloning}
                  >
                    {cloning ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> : <Copy className="h-4 w-4 flex-shrink-0" />}
                    <span className="truncate">{cloning ? "Cloning..." : "Clone as Draft"}</span>
                  </button>

                  <button
                    className="rounded-xl px-3 py-2.5 border border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5 flex-1"
                    onClick={handleCancel}
                    disabled={cancelling}
                  >
                    {cancelling ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> : <X className="h-4 w-4 flex-shrink-0" />}
                    <span className="truncate">{cancelling ? "Cancelling..." : "Cancel Recording"}</span>
                  </button>
                </div>
              </>
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
              <>
                <button
                  className="rounded-xl px-3 py-2.5 border border-border bg-hover hover:bg-hover/70 text-foreground text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
                  onClick={handleRetry}
                  disabled={isAnyActionLoading}
                >
                  {retrying ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> : <RotateCcw className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{retrying ? "Retrying..." : "Retry"}</span>
                </button>

                <button
                  className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
                  onClick={async () => {
                    await handleSubmit(
                      "draft",
                      effectiveJob.id
                    );
                  }}
                  disabled={isAnyActionLoading}
                >
                  {saving ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> : <Archive className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{saving ? "Saving..." : "Save as Draft"}</span>
                </button>

                <button
                  className="rounded-xl px-3 py-2.5 border border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
                  onClick={handleDelete}
                  disabled={isAnyActionLoading}
                >
                  {deleting ? <Loader className="h-4 w-4 animate-spin flex-shrink-0" /> : <Trash2 className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{deleting ? "Deleting..." : "Delete"}</span>
                </button>
              </>
            )}
          </>
        )}
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
});

CaptureActions.displayName = "CaptureActions";

export default CaptureActions;