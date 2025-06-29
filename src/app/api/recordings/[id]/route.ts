import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById, updateJob, deleteJob
} from "@/lib/jobStore";
import {
  RecordingQueueService
} from "@/services/RecordingQueueService";

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
      id: string
    }>
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
  } catch ( error ) {
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