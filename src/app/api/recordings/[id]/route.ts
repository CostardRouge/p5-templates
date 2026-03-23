import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById, deleteJob
} from "@/lib/jobStore";
import {
  RecordingQueueService
} from "@/services/RecordingQueueService";
import {
  deleteArtifact
} from "@/lib/connections/s3";

/**
 * GET /api/recordings/[id]
 *   → return the Job record from database
 */
export async function GET(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const jobId = ( await params ).id;

  try {
    const job = await getJobById( jobId );

    if ( !job ) {
      return new NextResponse(
        "Job not found",
        {
          status: 404,
        }
      );
    }

    return NextResponse.json( job );
  } catch ( error ) {
    console.error(
      `[GET /api/recordings/${ jobId }]`,
      error
    );

    return new NextResponse(
      "Internal Server Error",
      {
        status: 500,
      }
    );
  }
}

/**
 * DELETE /api/recordings/[id]
 *   → delete a finalized job and its artifacts
 *   → robust: always deletes DB record even if queue/S3 cleanup fails
 */
export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const jobId = ( await params ).id;

  try {
    const dbJob = await getJobById( jobId );

    if ( !dbJob ) {
      return new NextResponse(
        "Job not found",
        {
          status: 404,
        }
      );
    }

    if ( ![
      "failed",
      "draft",
      "completed",
      "cancelled"
    ].includes( dbJob.status ) ) {
      return new NextResponse(
        "Job is not finalized and cannot be deleted",
        {
          status: 400,
        }
      );
    }

    // Try to remove from queue (best effort)
    try {
      const bullJob = await RecordingQueueService.getInstance()
        .getQueue()
        .getJob( jobId );

      if ( bullJob ) {
        try {
          await bullJob.remove();
        } catch ( err ) {
          console.warn(
            `Could not remove job ${ jobId } from queue:`,
            err
          );
        }
      }
    } catch ( err ) {
      console.warn(
        `Error accessing queue for job ${ jobId }:`,
        err
      );
    }

    // Try to delete artifacts from S3 (best effort)
    try {
      await deleteArtifact( jobId );
    } catch ( err ) {
      console.warn(
        `Could not delete artifacts for job ${ jobId } from S3:`,
        err
      );
    }

    // Always delete from database (critical operation)
    try {
      await deleteJob( jobId );
    } catch ( err ) {
      console.error(
        `Failed to delete job ${ jobId } from database:`,
        err
      );
      return new NextResponse(
        "Failed to delete job from database",
        {
          status: 500,
        }
      );
    }

    return NextResponse.json( {
      deleted: true,
    } );
  } catch ( error ) {
    console.error(
      `[DELETE /api/recordings/${ jobId }]`,
      error
    );
    return new NextResponse(
      "Internal Server Error",
      {
        status: 500,
      }
    );
  }
}
