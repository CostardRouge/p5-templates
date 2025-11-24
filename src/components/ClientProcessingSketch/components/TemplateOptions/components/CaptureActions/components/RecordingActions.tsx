"use client";

import React from "react";
import { Copy, Loader, X } from "lucide-react";
import { JobModel } from "@/types/recording.types";
import CompactProgressBar from "@/components/CompactProgressBar";
import { getRecordingSteps } from "@/utils/recordingSteps";

type RecordingActionsProps = {
  persistedJob?: JobModel;
  jobId?: string;
  recordingProgress?: {
    percentage: number;
    status: string;
    recordingDuration?: number;
  };
  onClone: () => void;
  onCancel: () => void;
  cloning: boolean;
  cancelling: boolean;
};

export default function RecordingActions({
  persistedJob,
  jobId,
  recordingProgress,
  onClone,
  onCancel,
  cloning,
  cancelling,
}: RecordingActionsProps) {
  return (
    <>
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
      </div>

      {/* Compact Progress Bar with Steps */}
      <div className="px-1">
        <CompactProgressBar
          job={
            {
              ...persistedJob,
              id: persistedJob?.id || jobId || "",
              progress:
                recordingProgress?.percentage || persistedJob?.progress || 0,
              status: recordingProgress?.status || persistedJob?.status || "queued",
            } as JobModel
          }
          steps={
            (recordingProgress?.status || persistedJob?.status) === "active"
              ? getRecordingSteps({
                  ...persistedJob,
                  id: persistedJob?.id || jobId || "",
                  progress:
                    recordingProgress?.percentage || persistedJob?.progress || 0,
                  status:
                    recordingProgress?.status || persistedJob?.status || "active",
                } as JobModel)
              : []
          }
          startTime={
            jobId && recordingProgress?.recordingDuration
              ? Date.now() - recordingProgress.recordingDuration
              : undefined
          }
        />
      </div>

      <div className="flex gap-1">
        <button
          className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5 flex-1"
          onClick={onClone}
          disabled={cloning}
        >
          {cloning ? (
            <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
          ) : (
            <Copy className="h-4 w-4 flex-shrink-0" />
          )}
          <span>{cloning ? "Cloning..." : "Clone as Draft"}</span>
        </button>

        <button
          className="rounded-xl px-3 py-2.5 border border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5 flex-1"
          onClick={onCancel}
          disabled={cancelling}
        >
          {cancelling ? (
            <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
          ) : (
            <X className="h-4 w-4 flex-shrink-0" />
          )}
          <span>{cancelling ? "Cancelling..." : "Cancel Recording"}</span>
        </button>
      </div>
    </>
  );
}
