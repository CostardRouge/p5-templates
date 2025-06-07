import {
  NextResponse
} from "next/server";
import {
  getAllJobs
} from "@/lib/jobStore";

export async function GET() {
  try {
    const allJobs = await getAllJobs();

    return NextResponse.json( allJobs );
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
