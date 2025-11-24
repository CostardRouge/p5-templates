import { JobStatusEnum } from "@/types/recording.types";

/**
 * Determine the current recording status and UI states
 */
export function getRecordingStatus(currentStatus?: JobStatusEnum) {
  const isRecording = currentStatus && ["queued", "active"].includes(currentStatus);
  const isCompleted = currentStatus === "completed";
  const isFailed = ["failed", "cancelled"].includes(currentStatus || "");
  const isDraft = currentStatus === "draft";

  return {
    isRecording,
    isCompleted,
    isFailed,
    isDraft,
  };
}
