
import {
  NextRequest, NextResponse
} from "next/server";
import {
  v4 as uuid
} from "uuid";
import {
  setProgress
} from "@/lib/progressStore";
import runRecording from "@/lib/runRecording";

export async function POST(
  request: NextRequest,
  {
    params
  }: {
       params: Promise<{
         template: string
       }>
  },
) {
  const template = ( await params ).template;

  if ( !template ) {
    return new NextResponse(
      "Missing template",
      {
        status: 400
      }
    );
  }

  const jobId = uuid();
  const formData = await request.formData();

  setProgress(
    jobId,
    "queued",
    0
  );

  runRecording(
    jobId,
    template,
    formData
  ).catch( error => {
    console.error(
      "[record] job failed",
      jobId,
      error
    );
    setProgress(
      jobId,
      "error",
      100
    );
  } );

  return (
    NextResponse.json( {
      jobId
    } )
  );
}