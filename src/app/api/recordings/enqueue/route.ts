import {
  NextRequest, NextResponse
} from "next/server";
import {
  RecordingService
} from "@/lib/services/recording.service";
import {
  EnqueueRecordingRequest,
  EnqueueRecordingResponse
} from "@/types/recording.types";

export async function POST( request: NextRequest ): Promise<NextResponse<EnqueueRecordingResponse>> {
  try {
    const body: EnqueueRecordingRequest = await request.json();

    // Validate request body
    if ( !body.template || typeof body.template !== "string" ) {
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

    if ( !body.formData || typeof body.formData !== "object" ) {
      return NextResponse.json(
        {
          success: false,
          error: "Form data is required and must be an object"
        },
        {
          status: 400
        }
      );
    }

    const recordingService = RecordingService.getInstance();
    const jobId = await recordingService.enqueueRecording(
      body.template,
      body.formData
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
