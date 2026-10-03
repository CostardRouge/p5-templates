import {
  RecordingQueueService
} from "@/services/RecordingQueueService";
import {
  deleteJob, getJobById
} from "@/lib/jobStore";
import {
  deleteJobArtifacts
} from "@/lib/connections/s3";
import type {
  JobStatusEnum
} from "@/types/recording.types";

const DELETABLE_STATUSES: JobStatusEnum[] = [
  "failed",
  "draft",
  "completed",
  "cancelled"
];

export type DeleteRecordingOutcome = "deleted" | "not-found" | "not-finalized" | "failed";

/**
 * Delete one finalized recording job — the single implementation behind
 * `DELETE /api/recordings/[id]` and the bulk `DELETE /api/recordings/delete`.
 *
 * Queue and storage cleanup are best effort (logged, never fatal); the
 * database row is always deleted, so a job whose objects are already gone can
 * still be removed from the list. Throws only if the job lookup itself fails.
 */
export async function deleteRecordingJob( jobId: string ): Promise<DeleteRecordingOutcome> {
  const job = await getJobById( jobId );

  if ( !job ) {
    return "not-found";
  }

  if ( !DELETABLE_STATUSES.includes( job.status ) ) {
    return "not-finalized";
  }

  try {
    const bullJob = await RecordingQueueService.getInstance()
      .getQueue()
      .getJob( jobId );

    if ( bullJob ) {
      try {
        await bullJob.remove();
      } catch( err ) {
        console.warn(
          `Could not remove job ${ jobId } from queue:`,
          err
        );
      }
    }
  } catch( err ) {
    console.warn(
      `Error accessing queue for job ${ jobId }:`,
      err
    );
  }

  try {
    await deleteJobArtifacts(
      jobId,
      job.resultUrl ? [
        job.resultUrl
      ] : []
    );
  } catch( err ) {
    console.warn(
      `Could not delete artifacts for job ${ jobId } from S3:`,
      err
    );
  }

  try {
    await deleteJob( jobId );
  } catch( err ) {
    console.error(
      `Failed to delete job ${ jobId } from database:`,
      err
    );
    return "failed";
  }

  return "deleted";
}
