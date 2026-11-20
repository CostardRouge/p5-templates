import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById
} from "@/lib/jobStore";
import downloadObjectResponse from "@/utils/downloadObjectResponse";

/**
 * GET /api/options/download/[id]
 */
export async function GET(
  request: NextRequest,
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

    // Extract sketch name from template (e.g., "p5/photo-in-circle" -> "photo-in-circle")
    const sketchName = job.sketch.split( "/" ).pop() || "sketch";
    const jobIdShort = jobId.slice(
      0,
      8
    );

    // Format: {sketch-name}-options-{jobId}.json
    const filename = `${ sketchName }-options-${ jobIdShort }.json`;

    return downloadObjectResponse(
      `${ jobId }/options.json`,
      filename
    );
  } catch( error ) {
    console.error(
      `[GET /api/options/download/${ jobId }]`,
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
