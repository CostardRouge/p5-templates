import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById
} from "@/lib/jobStore";
import downloadObjectResponse from "@/utils/downloadObjectResponse";

/**
 * GET /api/recordings/download/[id]
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

    const s3Url = job.resultUrl;

    if ( !s3Url ) {
      return new NextResponse(
        "resultUrl not found",
        {
          status: 404
        }
      );
    }

    return downloadObjectResponse( s3Url );
  } catch( error ) {
    console.error(
      `[GET /api/recordings/download/${ jobId }]`,
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
