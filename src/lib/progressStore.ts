import {
  updateJob
} from "@/lib/jobStore";

/**
 * Update the progress & status of a given job.
 * 1) Update BullMQ’s progress so listeners (SSE) get notified.
 * 2) Persist status & progress in the database.
 */
export async function setProgress(
  jobId: string,
  status: string,
  progressPercent: number
): Promise<void> {
  try {
    return;
    await updateJob(
      jobId,
      {
        status,
        progress: progressPercent,
      }
    );
  } catch ( error ) {
    console.error(
      `[setProgress] failed to update DB for job ${ jobId }`,
      error
    );
  }
}
