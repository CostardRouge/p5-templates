
import {
  NextRequest, NextResponse
} from "next/server";
import {
  v4 as uuid
} from "uuid";
import { setProgress } from "@/lib/progressStore";
import { jobQueue } from "@/lib/jobQueue";
import { createJob } from "@/lib/jobsDB";
import type { JobAsset } from "@/lib/jobQueue";
import { uploadFile } from "@/lib/s3";

export async function POST(
  request: NextRequest,
  {
    params
  }: {
       params: Promise<{
         template: string
       }>
  },
) {
  const template = ( await params ).template;

  if ( !template ) {
    return new NextResponse(
      "Missing template",
      {
        status: 400
      }
    );
  }

  const jobId = uuid();
  createJob({ id: jobId, template, step: 'queued', progress: 0, createdAt: Date.now(), updatedAt: Date.now() });
  const formData = await request.formData();

  const options = JSON.parse(formData.get('options') as string);
  const assetFiles = formData.getAll('files[]').filter(f => (f as File).size) as File[];
  const assets: JobAsset[] = [];
  for (const file of assetFiles) {
    const buffer = Buffer.from(await file.arrayBuffer());
    assets.push({ name: file.name, buffer, type: file.type });
    await uploadFile(`jobs/${jobId}/assets/${file.name}`, buffer, file.type || 'application/octet-stream');
  }
  await uploadFile(`jobs/${jobId}/options.json`, JSON.stringify(options), 'application/json');

  setProgress(jobId, 'queued', 0);

  await jobQueue.add('render', { template, options, assets }, { jobId });

  return (
    NextResponse.json( {
      jobId
    } )
  );
}