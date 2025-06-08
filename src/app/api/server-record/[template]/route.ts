import {
  NextRequest, NextResponse
} from "next/server";
import {
  enqueueRecordingJob
} from "@/lib/recordQueue";

/**
 * Helper to convert a File object to a Base64‐encoded string
 */
async function fileToBase64( file: File ): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array( arrayBuffer );
  let binary = "";

  for ( let i = 0; i < uint8Array.byteLength; i++ ) {
    binary += String.fromCharCode( uint8Array[ i ] );
  }
  return `data:${ file.type };base64,${ btoa( binary ) }`;
}

/**
 * Serialize the incoming FormData into a plain object
 * that can be JSON‐stringified and enqueued.
 *
 * - "options" field is passed through as a string (JSON).
 * - "files[]" fields are converted to { name, contentBase64 } entries.
 */
async function serializeFormData( formData: FormData ): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {
  };

  // Copy any non‐file fields directly (e.g. "options")
  for ( const [
    key,
    value
  ] of formData.entries() ) {
    if ( key === "files[]" ) {
      continue;
    }
    // value is a string for regular fields
    result[ key ] = value;
  }

  // Handle files[]
  const files = formData
    .getAll( "files[]" )
    .filter( ( file ) => ( file as File ).size > 0 ) as File[];

  if ( files.length > 0 ) {
    result[ "files" ] = await Promise.all( files.map( async( file ) => {
      const base64Content = await fileToBase64( file );

      return {
        name: file.name,
        base64Content,
      };
    } ) );
  }

  return result;
}

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

  const recordingJobPayload: {
    template: string,
    jobId?: string,
    serializeFormData?: Record<string, unknown>
  } = {
    template,
    jobId: undefined,
    serializeFormData: undefined
  };

  try {
    const formData = await request.formData();

    recordingJobPayload.serializeFormData = await serializeFormData( formData );
  } catch ( error ) {
    console.error(
      "[server-record] error serializing form data",
      error
    );
    return new NextResponse(
      "Failed to parse payload",
      {
        status: 500
      }
    );
  }

  try {
    // Enqueue the job
    recordingJobPayload.jobId = await enqueueRecordingJob(
      template,
      recordingJobPayload.serializeFormData
    );
  } catch ( error ) {
    console.error(
      "[server-record] enqueue failed",
      error
    );
    return new NextResponse(
      "Failed to enqueue job",
      {
        status: 500
      }
    );
  }

  return (
    NextResponse.json( {
      jobId: recordingJobPayload.jobId,
    } )
  );
}