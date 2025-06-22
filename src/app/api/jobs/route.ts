import {
  NextResponse, NextRequest
} from "next/server";
import {
  getAllJobs
} from "@/lib/jobStore";

const validStatuses = [
  "queued",
  "active",
  "completed",
  "failed",
  "cancelled"
] as const;

type JobStatusEnum = typeof validStatuses[number];

function isValidStatus( value: string ): value is JobStatusEnum {
  return validStatuses.includes( value as JobStatusEnum );
}

export async function GET( req: NextRequest ) {
  try {
    const statusParam = req.nextUrl.searchParams.get( "status" );
    const statusFilter = statusParam
      ?.split( "," )
      .map( s => s.trim() )
      .filter( isValidStatus );

    const jobs = await getAllJobs( statusFilter );

    return NextResponse.json( jobs );
  } catch ( error ) {
    console.error(
      "[GET /api/jobs] error fetching jobs",
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

