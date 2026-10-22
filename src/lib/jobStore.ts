import {
  prisma
} from "@/lib/connections/prisma";
import {
  updateRecordingStatus
} from "@/lib/progression";
import {
  JobModel, JobStatusEnum
} from "@/types/recording.types";

/**
 * Create a new Job record with status = 'queued' and progress = 0
 */
export async function createJob(
  id: string,
  sketch: string,
  status: JobStatusEnum
): Promise<JobModel> {
  return prisma.job.create( {
    data: {
      id,
      status,
      sketch,
      progress: 0
    }
  } );
}

/**
 * Update a Job record by ID.
 * Only the provided fields in `data` will be updated.
 */
/**
 * A reason belongs to a failure: an update that sets any other status clears
 * `error`, so a retried, restarted or completed job never shows the last
 * attempt's reason — one rule here instead of one line in every route that
 * re-queues a job.
 */
export function withFailureReasonRule( data: Partial<JobModel> ): Partial<JobModel> {
  return data.status && data.status !== "failed" && !( "error" in data )
    ? {
      ...data,
      error: null
    }
    : data;
}

export async function updateJob(
  jobId: string,
  data: Partial<JobModel>
): Promise<void> {
  const write = withFailureReasonRule( data );

  await prisma.job.update( {
    where: {
      id: jobId
    },
    // @ts-ignore
    data: write
  } );

  if ( data.status ) {
    await updateRecordingStatus(
      jobId,
      data.status
    );
  }
}

/**
 * Retrieve a single Job record by ID (or null if not found)
 */
export async function getJobById( jobId: string ): Promise<JobModel | null> {
  return prisma.job.findUnique( {
    where: {
      id: jobId
    }
  } ) as Promise<JobModel | null>;
}

/**
 * Retrieve all Jobs, ordered by creation date descending
 */
export async function getAllJobs( status?: JobStatusEnum[] ): Promise<JobModel[]> {
  return prisma.job.findMany( {
    where: status
      ? {
        status: {
          in: status
        }
      }
      : undefined,
    orderBy: {
      createdAt: "desc"
    }
  } );
}

/**
 * Delete a Job record by ID
 */
export async function deleteJob( jobId: string ): Promise<void> {
  await prisma.job.delete( {
    where: {
      id: jobId
    }
  } );
}
