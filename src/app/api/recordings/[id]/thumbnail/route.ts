import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById
} from "@/lib/jobStore";
import {
  getDownloadUrlFromS3Url
} from "@/lib/connections/s3";
import getP5SketchThumbnailURL from "@/utils/getP5SketchThumbnailURL";

/**
 * GET /api/recordings/[id]/thumbnail
 * Redirects to the recording thumbnail or falls back to sketch template thumbnail
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

    // Only try to get recording thumbnail for completed jobs with thumbnails
    if ( job.status === "completed" && job.thumbnails ) {
      const thumbnails = job.thumbnails as unknown as string[];

      if ( thumbnails.length > 0 ) {
        try {
          // Generate signed URL for the first thumbnail
          const signedUrl = await getDownloadUrlFromS3Url(
            thumbnails[ 0 ],
            3600
          );

          // Redirect to the signed S3 URL
          return NextResponse.redirect(
            signedUrl,
            302
          );
        } catch ( error ) {
          console.error(
            "Failed to generate signed URL for thumbnail:",
            error
          );
          // Fall through to template thumbnail
        }
      }
    }

    // Fall back to sketch template thumbnail
    const templateThumbnailUrl = getP5SketchThumbnailURL( job.template.replace(
      "p5",
      ""
    ) );

    // Convert relative URL to absolute URL for redirect
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    `${ _req.nextUrl.protocol }//${ _req.nextUrl.host }`;
    const absoluteUrl = new URL(
      templateThumbnailUrl,
      baseUrl
    ).toString();

    return NextResponse.redirect(
      absoluteUrl,
      302
    );
  } catch ( error ) {
    console.error(
      `[GET /api/recordings/${ jobId }/thumbnail]`,
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
