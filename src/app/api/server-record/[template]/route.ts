// app/api/server-record/[template]/route.ts
import {
  NextRequest, NextResponse
} from "next/server";
import {
  v4 as uuid
} from "uuid";
import {
  setProgress
} from "@/lib/progressStore";
import {
  runRecording
} from "@/lib/runRecording";

export async function POST(
  req: NextRequest,
  {
    params
  }: {
       params: Promise<{
         template: string
       }>
  },
) {
  const template = ( await params ).template;

  if ( !template ) return new NextResponse(
    "Missing template",
    {
      status: 400
    }
  );

  /* grab caller payload (options + files[]), but don’t block the response */
  const formData = await req.formData();

  /* 1️⃣ create job entry */
  const jobId = uuid();

  setProgress(
    jobId,
    "queued",
    0
  );

  /* 2️⃣ fire‑and‑forget recording pipeline */
  runRecording(
    jobId,
    template,
    formData
  ).catch( err => {
    console.error(
      "[record] job failed",
      jobId,
      err
    );
    setProgress(
      jobId,
      "error",
      100
    );
  } );

  /* 3️⃣ return jobId so client can open SSE */
  return NextResponse.json( {
    jobId
  } );
}