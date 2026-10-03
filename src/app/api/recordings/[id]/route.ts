import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById
} from "@/lib/jobStore";
import {
  deleteRecordingJob
} from "@/lib/deleteRecordingJob";

/**
 * GET /api/recordings/[id]
 *   → return the Job record from database
 */
export async function GET(
  _req: NextRequest,
  {
    params
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
          status: 404
        }
      );
    }

    return NextResponse.json( job );
  } catch( error ) {
    console.error(
      `[GET /api/recordings/${ jobId }]`,
      error
    );

    return new NextResponse(
      "Internal Server Error",
      {
        status: 500
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
    params
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const jobId = ( await params ).id;

  try {
    const outcome = await deleteRecordingJob( jobId );

    if ( outcome === "not-found" ) {
      return new NextResponse(
        "Job not found",
        {
          status: 404
        }
      );
    }

    if ( outcome === "not-finalized" ) {
      return new NextResponse(
        "Job is not finalized and cannot be deleted",
        {
          status: 400
        }
      );
    }

    if ( outcome === "failed" ) {
      return new NextResponse(
        "Failed to delete job from database",
        {
          status: 500
        }
      );
    }

    return NextResponse.json( {
      deleted: true
    } );
  } catch( error ) {
    console.error(
      `[DELETE /api/recordings/${ jobId }]`,
      error
    );
    return new NextResponse(
      "Internal Server Error",
      {
        status: 500
      }
    );
  }
}
