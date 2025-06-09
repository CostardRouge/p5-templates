import {
  NextRequest, NextResponse
} from "next/server";
import {
  RecordingService
} from "@/lib/services/recording.service";

interface ControlRequest {
  action: "pause" | "resume";
}

export async function POST( request: NextRequest ): Promise<NextResponse> {
  // @ts-ignore
  let body: ControlRequest = undefined;

  try {
    body = await request.json();

    if ( !body.action || ![
      "pause",
      "resume"
    ].includes( body.action ) ) {
      return NextResponse.json(
        {
          error: "Action must be either \"pause\" or \"resume\""
        },
        {
          status: 400
        }
      );
    }

    const recordingService = RecordingService.getInstance();

    if ( body.action === "pause" ) {
      await recordingService.pauseProcessing();
    } else {
      await recordingService.resumeProcessing();
    }

    return NextResponse.json( {
      success: true,
      message: `Recording processing ${ body.action }d successfully`
    } );
  } catch ( error ) {
    console.error(
      `[API] Error ${ body?.action }ing recordings:`,
      error
    );

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error"
      },
      {
        status: 500
      }
    );
  }
}