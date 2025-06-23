import {
  addRecordingStatus, addRecordingSteps,
  getRecordingStatusAndTotalPercentage, updateRecordingStepPercentage
} from "@/lib/progression";

import {
  NextResponse, NextRequest
} from "next/server";
import {
  JobId
} from "@/types/recording.types";
import {
  getRecordingSketchStepsByOptions
} from "@/lib/progression/steps";

/**
 * GET /api/progression/[id]
 */
export async function GET(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: JobId
    }>
  }
) {
  const id = ( await params ).id;

  // await addRecordingStatus(
  //   id,
  //   "lol"
  // );

  // await addRecordingSteps(
  //   id,
  //   getRecordingSketchStepsByOptions( {
  //     slides: [
  //       {
  //         template: "1"
  //       },
  //       {
  //         template: "2"
  //       }
  //     ]
  //   } ),
  //   "active"
  // );

  // await updateRecordingStepPercentage(
  //   id,
  //   "recording.slide-0.saving-frames",
  //   55
  // );

  const recordingStatusAndTotalPercentage = await getRecordingStatusAndTotalPercentage( id );

  if ( !recordingStatusAndTotalPercentage ) {
    return new NextResponse(
      `recordingStatusAndTotalPercentage not found for job ${ id }`,
      {
        status: 404
      }
    );
  }

  return Response.json( recordingStatusAndTotalPercentage );
}