import {
  NextRequest, NextResponse
} from "next/server";
import {
  RecordingService
} from "@/lib/services/RecordingService";
import {
  EnqueueRecordingRequest,
  EnqueueRecordingResponse
} from "@/types/recording.types";

export async function POST( request: NextRequest ): Promise<NextResponse<EnqueueRecordingResponse>> {
  try {
    const formData = await request.formData();
    const template = formData.get( "template" );

    // Validate request body
    if ( !template || typeof template !== "string" ) {
      return NextResponse.json(
        {
          success: false,
          error: "Template is required and must be a string"
        },
        {
          status: 400
        }
      );
    }

    const options = formData.get( "options" );

    // Validate request body
    if ( !options || typeof options !== "string" ) {
      return NextResponse.json(
        {
          success: false,
          error: "Options is required and must be a string"
        },
        {
          status: 400
        }
      );
    }

    const files = <File[]>formData
      .getAll( "files[]" )
      .filter( file => (
        ( file as File )?.size && ( file as File )?.name
      ) );

    const recordingService = RecordingService.getInstance();
    const jobId = await recordingService.enqueueRecording(
      template,
      <string>options,
      files
    );

    return NextResponse.json( {
      success: true,
      jobId,
    } );
  } catch ( error ) {
    console.error(
      "[API] Error enqueuing recording:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error"
      },
      {
        status: 500
      }
    );
  }
}
