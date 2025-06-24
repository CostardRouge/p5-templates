import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById
} from "@/lib/jobStore";
import {
  getDownloadUrlFromS3Url
} from "@/lib/connections/s3";
import downloadFromUrlResponse from "@/utils/downloadFromUrlResponse";

/**
 * GET /api/options/download/[id]
 */
export async function GET(
  request: NextRequest,
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

    const s3DownloadUrl = await getDownloadUrlFromS3Url( `${ jobId }/options.json` );

    return downloadFromUrlResponse( s3DownloadUrl );
  } catch ( error ) {
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
