import {
  useMemo
} from "react";
import type {
  JobId, JobModel, JobStatusEnum, RecordingProgressionStream
} from "@/types/recording.types";

export type LifecycleState =
  | "no-job"
  | "draft"
  | "queued"
  | "active"
  | "completed"
  | "failed"
  | "cancelled";

type UseRecordingLifecycleProps = {
  persistedJob?: JobModel;
  recordingProgress?: RecordingProgressionStream | null;
  jobId?: JobId;
};

export type RecordingLifecycle = {
  state: LifecycleState;
  currentStatus: JobStatusEnum | undefined;
  effectiveJob: JobModel | undefined;
  isLocked: boolean;
  canAutoSave: boolean;
  isRecording: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isDraft: boolean;
  hasNoJob: boolean;
};

const LOCKED_STATUSES: ReadonlyArray<JobStatusEnum> = [
  "queued",
  "active",
  "completed"
];

export function useRecordingLifecycle( {
  persistedJob,
  recordingProgress,
  jobId
}: UseRecordingLifecycleProps ): RecordingLifecycle {
  return useMemo(
    () => {
      const currentStatus = ( recordingProgress?.status ||
        persistedJob?.status ) as JobStatusEnum | undefined;

      const hasNoJob = !persistedJob && !recordingProgress && !jobId;

      const isRecording =
        currentStatus === "queued" || currentStatus === "active";
      const isCompleted = currentStatus === "completed";
      const isFailed =
        currentStatus === "failed" || currentStatus === "cancelled";
      const isDraft = currentStatus === "draft";

      const state: LifecycleState = hasNoJob
        ? "no-job"
        : ( currentStatus ?? "draft" );

      const effectiveJob: JobModel | undefined =
        persistedJob ||
        ( jobId
          ? ( {
            id: jobId,
            status: currentStatus || "queued",
            progress: recordingProgress?.percentage || 0
          } as JobModel )
          : undefined );

      const isLocked =
        !!currentStatus && LOCKED_STATUSES.includes( currentStatus );
      const canAutoSave = isDraft;

      return {
        state,
        currentStatus,
        effectiveJob,
        isLocked,
        canAutoSave,
        isRecording,
        isCompleted,
        isFailed,
        isDraft,
        hasNoJob
      };
    },
    [
      persistedJob,
      recordingProgress,
      jobId
    ]
  );
}
