import {
  NextRequest, NextResponse
} from "next/server";
import {
  prisma
} from "@/lib/connections/prisma";
import {
  RecordingQueueService
} from "@/lib/services/RecordingQueueService";
import {
  Job
} from "bullmq";
import {
  deleteJob,
  getJobById
} from "@/lib/jobStore";
import {
  deleteArtifact
} from "@/lib/connections/s3";

export async function DELETE( req: NextRequest ) {
  try {
    const {
      ids
    }: {
      ids: string[]
    } = await req.json();

    if ( !Array.isArray( ids ) || ids.length === 0 ) {
      return new NextResponse(
        "Missing or invalid job IDs",
        {
          status: 400
        }
      );
    }

    const deleted = [
    ];

    for ( const jobId of ids ) {
      const dbJob = await getJobById( jobId );

      if ( !dbJob ) {
        continue;
      }

      if ( ![
        "completed",
        "cancelled",
      ].includes( dbJob.status ) ) {
        console.warn( `Job ${ jobId } is not finalized and cannot be deleted.` );
        continue;
      }

      try {
        const bullJob: Job | undefined = await RecordingQueueService
          .getInstance()
          .getQueue()
          .getJob( jobId );

        if ( bullJob ) {
          const state = await bullJob.getState();

          console.log( {
            state
          } );

          if ( [
            "waiting",
            "delayed"
          ].includes( state ) ) {
            await bullJob.remove();
          }
        }
      }
      catch ( error ) {

      }

      await deleteJob( jobId );
      await deleteArtifact( jobId );

      deleted.push( jobId );
    }

    return NextResponse.json( {
      deleted
    } );
  } catch ( err ) {
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
