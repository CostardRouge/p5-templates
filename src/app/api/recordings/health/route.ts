import {
  NextResponse
} from "next/server";
import {
  RecordingService
} from "@/services/RecordingService";
import {
  QueueHealthResponse
} from "@/types/recording.types";

export async function GET(): Promise<NextResponse<QueueHealthResponse | {
 error: string
}>> {
  try {
    const recordingService = RecordingService.getInstance();
    const health = await recordingService.getQueueHealth();

    return NextResponse.json( health );
  } catch ( error ) {
    console.error(
      "[API] Error getting queue health:",
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