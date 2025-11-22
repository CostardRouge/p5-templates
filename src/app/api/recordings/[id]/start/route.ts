import { NextRequest, NextResponse } from "next/server";
import { getJobById, updateJob } from "@/lib/jobStore";
import { RecordingService } from "@/services/RecordingService";
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

    if (["queued", "active"].includes(job.status)) {
      return NextResponse.json({ started: false, reason: "already in-flight" });
    }

    if (![
      "draft",
      "failed",
      "cancelled",
    ].includes(job.status)) {
      return new NextResponse("Job not startable in current state", { status: 400 });
    }

    // Reflect queued state in DB & SSE before worker picks it up
    await updateJob(jobId, { status: "queued", progress: 0 });
    await addRecordingStatus(jobId, "queued");

    await RecordingService.getInstance().startRecording(job.id, job.template);

    return NextResponse.json({ started: true });
  } catch (error) {
    console.error(`[POST /api/recordings/${jobId}/start]`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
