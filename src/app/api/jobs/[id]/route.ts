import {
  NextRequest, NextResponse
} from "next/server";
import {
  getJobById, updateJob, deleteJob
} from "@/lib/jobStore";
import {
  RecordingQueueService
} from "@/lib/services/RecordingQueueService";

/**
 * GET /api/jobs/[id]
 *   → return the Job record from database
 */
export async function GET(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: string
    }>
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

    return NextResponse.json( job );
  } catch ( error ) {
    console.error(
      `[GET /api/jobs/${ jobId }]`,
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

/**
 * DELETE /api/jobs/[id]
 *   → cancel a queued or active job: remove from Bull queue and mark as 'cancelled'
 */
export async function DELETE(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: string
    }>
  }
) {
  const jobId = ( await params ).id;

  try {
    // 1) Try to remove from BullMQ queue
    const bullJob = await RecordingQueueService
      .getInstance()
      .getQueue()
      .getJob( jobId );

    const token = bullJob?.token;

    if ( bullJob && token ) {
      await bullJob.moveToFailed(
        new Error( "removed by user" ),
        token
      );
      await bullJob.remove();
    }

    // 2) Update DB status to 'cancelled'
    await updateJob(
      jobId,
      {
        status: "cancelled",
        progress: 100
      }
    );

    // 3) Also delete the Prisma record if you prefer (optional)
    await deleteJob( jobId );

    return new NextResponse(
      null,
      {
        status: 204
      }
    );
  } catch ( error ) {
    console.error(
      `[DELETE /api/jobs/${ jobId }]`,
      error
    );

    return new NextResponse(
      "Failed to cancel job",
      {
        status: 500
      }
    );
  }
}

/**
 * POST /api/jobs/[id]?cmd=retry
 * POST /api/jobs/[id]?cmd=stop
 *   → either retry a failed job, or signal a running job to stop
 */
export async function POST(
  req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: string
    }>
  }
) {
  const url = new URL( req.url );
  const jobId = ( await params ).id;
  const command = url.searchParams.get( "cmd" );

  if ( command === "retry" ) {
    try {
      const bullJob = await RecordingQueueService
        .getInstance()
        .getQueue()
        .getJob( jobId );

      if ( !bullJob ) {
        return new NextResponse(
          "Job not found in queue",
          {
            status: 404
          }
        );
      }

      await bullJob.retry();

      await updateJob(
        jobId,
        {
          status: "queued",
          progress: 0
        }
      );

      return new NextResponse(
        null,
        {
          status: 204
        }
      );
    } catch ( error ) {
      console.error(
        `[POST /api/jobs/${ jobId }?cmd=retry]`,
        error
      );

      return new NextResponse(
        "Failed to retry job",
        {
          status: 500
        }
      );
    }
  }

  if ( command === "stop" ) {
    try {
      // 1) Set a Redis key that runRecording() or the worker logic can check
      // await redisConnection.set(
      //   `cancel:${ jobId }`,
      //   "1"
      // );

      // 2) Mark status in DB so UI updates
      await updateJob(
        jobId,
        {
          status: "cancelled",
          progress: 100
        }
      );

      return new NextResponse(
        null,
        {
          status: 204
        }
      );
    } catch ( error ) {
      console.error(
        `[POST /api/jobs/${ jobId }?cmd=stop]`,
        error
      );

      return new NextResponse(
        "Failed to stop job",
        {
          status: 500
        }
      );
    }
  }

  return new NextResponse(
    "Invalid command",
    {
      status: 400
    }
  );
}
