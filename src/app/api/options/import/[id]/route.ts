import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById, updateJob
} from "@/lib/jobStore";

/**
 * POST /api/options/import/[id]
 * Import options.json into an existing job
 * Only works for draft, failed, and cancelled jobs
 */
export async function POST(
  request: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const jobId = ( await params ).id;

  try {
    const job = await getJobById( jobId );

    if ( !job ) {
      return new NextResponse(
        "Job not found",
        {
          status: 404
        }
      );
    }

    // Only allow import for specific statuses
    const allowedStatuses = [
      "draft",
      "failed",
      "cancelled"
    ];

    if ( !allowedStatuses.includes( job.status ) ) {
      return NextResponse.json(
        {
          error: `Cannot import options for job with status: ${ job.status }. Only draft, failed, and cancelled jobs can be updated.`
        },
        {
          status: 400
        }
      );
    }

    // Parse the uploaded options.json
    const formData = await request.formData();
    const file = formData.get( "file" );

    if ( !file || !( file instanceof File ) ) {
      return NextResponse.json(
        {
          error: "No file provided"
        },
        {
          status: 400
        }
      );
    }

    const fileContent = await file.text();
    let importedOptions;

    try {
      importedOptions = JSON.parse( fileContent );
    } catch ( error ) {
      return NextResponse.json(
        {
          error: "Invalid JSON file"
        },
        {
          status: 400
        }
      );
    }

    // Remove assets from imported options (too complicated to handle)
    if ( importedOptions.assets ) {
      delete importedOptions.assets;
    }

    if ( importedOptions.slides ) {
      importedOptions.slides = importedOptions.slides.map( ( slide: any ) => {
        const {
          assets, ...rest
        } = slide;

        return rest;
      } );
    }

    // Keep the original job ID
    importedOptions.id = jobId;

    // Update the job with new options
    await updateJob(
      jobId,
      {
        options: importedOptions,
        // Reset progress if it was failed/cancelled
        progress: job.status !== "draft" ? 0 : job.progress
      }
    );

    return NextResponse.json( {
      success: true,
      jobId
    } );
  } catch ( error ) {
    console.error(
      `[POST /api/options/import/${ jobId }]`,
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
