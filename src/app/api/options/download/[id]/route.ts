import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById
} from "@/lib/jobStore";
import {
  getDownloadUrlFromS3Url
} from "@/lib/connections/s3";

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

    const s3DownloadUrl = await getDownloadUrlFromS3Url( `${ jobId }/options.json` );

    // Fetch the file from S3
    const response = await fetch( s3DownloadUrl );

    if ( !response.ok || !response.body ) {
      return new NextResponse(
        "Failed to fetch file from S3",
        {
          status: 502
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

    return new Response(
      response.body,
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${ filename }"`
        }
      }
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
