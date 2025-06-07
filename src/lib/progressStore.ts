/* --------------------------------------------------------------------------
   lib/progressStore.ts
   --------------------------------------------------------------------------
   Centralized progress updater:
   • updates BullMQ job progress
   • persists status & progress into Prisma
   -------------------------------------------------------------------------- */

import {
  recordQueue
} from "@/lib/recordQueue";
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
  // 1) Update BullMQ job progress (if the job still exists in Redis)
  try {
    const bullJob = await recordQueue.getJob( jobId );

    if ( bullJob ) {
      await bullJob.updateProgress( progressPercent );
    }
  } catch ( error ) {
    console.warn(
      `[setProgress] could not update BullMQ job ${ jobId }`,
      error
    );
  }

  // 2) Persist into Prisma
  try {
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
