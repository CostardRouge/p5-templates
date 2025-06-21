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
  id: string, template: string, status: JobStatusEnum
): Promise<JobModel> {
  return prisma.job.create( {
    data: {
      id,
      status,
      template,
      progress: 0,
    },
  } );
}

/**
 * Update a Job record by ID.
 * Only the provided fields in `data` will be updated.
 */
export async function updateJob(
  jobId: string,
  data: Partial<JobModel & {
    fileKeys: string[]
  }>
): Promise<void> {
  await prisma.job.update( {
    where: {
      id: jobId
    },
    data,
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
    },
  } ) as Promise<JobModel | null>;
}

/**
 * Retrieve all Jobs, ordered by creation date descending
 */
export async function getAllJobs(): Promise<JobModel[]> {
  return prisma.job.findMany( {
    orderBy: {
      createdAt: "desc"
    }
  } ) as Promise<JobModel[]>;
}

/**
 * Delete a Job record by ID
 */
export async function deleteJob( jobId: string ): Promise<void> {
  await prisma.job.delete( {
    where: {
      id: jobId
    },
  } );
}
