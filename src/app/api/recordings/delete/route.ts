import {
  NextRequest, NextResponse
} from "next/server";
import {
  prisma
} from "@/lib/connections/prisma";
import {
  RecordingQueueService
} from "@/services/RecordingQueueService";
import {
  Job
} from "bullmq";
import {
  deleteJob, getJobById
} from "@/lib/jobStore";
import {
  deleteArtifact
} from "@/lib/connections/s3";

export async function DELETE( req: NextRequest ) {
  try {
    const {
      ids
    }: {
      ids: string[];
    } = await req.json();

    if ( !Array.isArray( ids ) || ids.length === 0 ) {
      return new NextResponse(
        "Missing or invalid job IDs",
        {
          status: 400
        }
      );
    }

    const deleted = [];
    const failed = [];

    for ( const jobId of ids ) {
      try {
        const dbJob = await getJobById( jobId );

        if ( !dbJob ) {
          console.warn( `Job ${ jobId } not found, skipping.` );
          continue;
        }

        if (
          ![
            "failed",
            "draft",
            "completed",
            "cancelled"
          ].includes( dbJob.status )
        ) {
          console.warn( `Job ${ jobId } is not finalized and cannot be deleted.` );
          continue;
        }

        // Try to remove from queue (best effort)
        try {
          const bullJob: Job | undefined =
            await RecordingQueueService.getInstance().getQueue()
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

        // Try to delete artifacts from S3 (best effort)
        try {
          await deleteArtifact( jobId );
        } catch( err ) {
          console.warn(
            `Could not delete artifacts for job ${ jobId } from S3:`,
            err
          );
        }

        // Always delete from database (critical operation)
        try {
          await deleteJob( jobId );
          deleted.push( jobId );
        } catch( err ) {
          console.error(
            `Failed to delete job ${ jobId } from database:`,
            err
          );
          failed.push( jobId );
        }
      } catch( err ) {
        console.error(
          `Error processing job ${ jobId }:`,
          err
        );
        failed.push( jobId );
      }
    }

    return NextResponse.json( {
      deleted,
      failed
    } );
  } catch( err ) {
    console.error(
      "[DELETE /api/recordings] error:",
      err
    );
    return new NextResponse(
      "Internal Server Error",
      {
        status: 500
      }
    );
  }
}
