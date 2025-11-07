import { NextRequest, NextResponse } from "next/server";
import { getJobById, updateJob } from "@/lib/jobStore";
import { RecordingQueueService } from "@/services/RecordingQueueService";
import { addRecordingStatus } from "@/lib/progression";

export async function POST(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{ id: string }>
  }
) {
  const jobId = (await params).id;

  try {
    const job = await getJobById(jobId);

    if (!job) {
      return new NextResponse("Job not found", { status: 404 });
    }

    if (![
      "failed",
      "cancelled",
    ].includes(job.status)) {
      return new NextResponse("Job is not retryable in current state", { status: 400 });
    }

    // Reflect queued state in DB & SSE before worker picks it up
    await updateJob(jobId, { status: "queued", progress: 0 });
    await addRecordingStatus(jobId, "queued");

    await RecordingQueueService
      .getInstance()
      .getQueue()
      .add(
        "process-recording",
        {
          jobId: job.id,
          template: job.template,
        },
        {
          jobId,
          priority: 1,
          delay: 0,
          removeOnFail: true,
          removeOnComplete: true,
        }
      );

    return NextResponse.json({ retried: true });
  } catch (error) {
    console.error(`[POST /api/recordings/${jobId}/retry]`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
