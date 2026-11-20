import {
  NextRequest, NextResponse
} from "next/server";
import {
  deleteRecordingJob
} from "@/lib/deleteRecordingJob";

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
        const outcome = await deleteRecordingJob( jobId );

        if ( outcome === "deleted" ) {
          deleted.push( jobId );
        } else if ( outcome === "failed" ) {
          failed.push( jobId );
        } else if ( outcome === "not-found" ) {
          console.warn( `Job ${ jobId } not found, skipping.` );
        } else {
          console.warn( `Job ${ jobId } is not finalized and cannot be deleted.` );
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
