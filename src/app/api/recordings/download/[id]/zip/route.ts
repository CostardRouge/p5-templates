import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById
} from "@/lib/jobStore";
import {
  getBufferFromS3Url, getDownloadUrlFromS3Url
} from "@/lib/connections/s3";
import downloadFromUrlResponse from "@/utils/downloadFromUrlResponse";
import archiver from "archiver";
import {
  Readable
} from "stream";

/**
 * GET /api/recordings/download/[id]/zip
 * Download all videos as a zip file
 * For multi-slide recordings, creates a zip on-the-fly from videoUrls
 * For old recordings, uses the existing resultUrl zip file
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

    const videoUrls = job.videoUrls ? ( job.videoUrls as unknown as string[] ) : [
    ];

    // If this is an old recording with a zip file in resultUrl, use that
    if ( job.resultUrl?.endsWith( ".zip" ) ) {
      const s3DownloadUrl = await getDownloadUrlFromS3Url( job.resultUrl );

      return downloadFromUrlResponse( s3DownloadUrl );
    }

    // For new multi-slide recordings, create zip on-the-fly
    if ( videoUrls.length === 0 ) {
      return new NextResponse(
        "No videos found",
        {
          status: 404
        }
      );
    }

    // Create a zip archive
    const archive = archiver(
      "zip",
      {
        zlib: {
          level: 0
        }
      }
    ); // No compression for speed

    // Set up response headers
    const headers = new Headers();

    headers.set(
      "Content-Type",
      "application/zip"
    );
    headers.set(
      "Content-Disposition",
      `attachment; filename="${ job.template }-${ jobId }.zip"`
    );

    // Convert archive to web stream
    const stream = Readable.toWeb( archive ) as ReadableStream;

    // Download each video from S3 and add to zip
    const downloadPromises = videoUrls.map( async(
      s3Key, index
    ) => {
      try {
        const buffer = await getBufferFromS3Url( s3Key );
        // Extract file extension from S3 key (e.g., "path/to/video.webm" -> ".webm")
        const extension = s3Key.substring( s3Key.lastIndexOf( "." ) );
        const filename = `slide-${ index + 1 }${ extension }`;

        archive.append(
          buffer,
          {
            name: filename
          }
        );
      } catch ( error ) {
        console.error(
          `Failed to download video ${ index }:`,
          error
        );
      }
    } );

    // Wait for all downloads to complete
    await Promise.all( downloadPromises );

    // Finalize the archive
    archive.finalize();

    return new NextResponse(
      stream,
      {
        headers
      }
    );
  } catch ( error ) {
    console.error(
      `[GET /api/recordings/download/${ jobId }/zip]`,
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
