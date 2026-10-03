import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById
} from "@/lib/jobStore";
import downloadObjectResponse from "@/utils/downloadObjectResponse";

/**
 * GET /api/recordings/download/[id]/slide/[slideIndex]
 * Download a specific slide video
 */
export async function GET(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: string;
      slideIndex: string;
    }>;
  }
) {
  const {
    id: jobId, slideIndex
  } = await params;
  const index = parseInt(
    slideIndex,
    10
  );

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

    const videoUrls = job.videoUrls
      ? ( job.videoUrls as unknown as string[] )
      : [];

    if ( isNaN( index ) || index < 0 || index >= videoUrls.length ) {
      return new NextResponse(
        "Invalid slide index",
        {
          status: 400
        }
      );
    }

    const s3Url = videoUrls[ index ];

    if ( !s3Url ) {
      return new NextResponse(
        "Video URL not found",
        {
          status: 404
        }
      );
    }

    return downloadObjectResponse( s3Url );
  } catch( error ) {
    console.error(
      `[GET /api/recordings/download/${ jobId }/slide/${ slideIndex }]`,
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
