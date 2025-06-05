import {
  NextRequest, NextResponse
} from "next/server";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * Download endpoint.
 * GET /api/video?id=<jobId>
 * Looks for output_<id>_*.mp4 in the tmp folder created by runRecording().
 */
export async function GET( request: NextRequest ) {
  const jobId = request.nextUrl.searchParams.get( "id" );

  if ( !jobId ) {
    return new NextResponse(
      "Missing id",
      {
        status: 400
      }
    );
  }

  /* temporary directory used in runRecording() */
  const recordingDirectory = path.join(
    os.tmpdir(),
    jobId
  );

  try {
    const fileNames = await fsPromises.readdir( recordingDirectory );
    const videoFileName = fileNames.find( name => name.endsWith( ".mp4" ) ) ?? null;

    if ( !videoFileName ) {
      return new NextResponse(
        "Video not found",
        {
          status: 404
        }
      );
    }

    const videoFullPath = path.join(
      recordingDirectory,
      videoFileName
    );
    const videoReadStream = fs.createReadStream( videoFullPath );

    /* stream the file as an attachment */
    return new NextResponse(
 videoReadStream as any,
 {
   headers: {
     "Content-Type": "video/mp4",
     "Content-Disposition": `attachment; filename="${ videoFileName }"`,
   },
 }
    );
  } catch ( error ) {
    console.error(
      "[download] failed",
      error
    );
    return new NextResponse(
      "Internal error",
      {
        status: 500
      }
    );
  }
}