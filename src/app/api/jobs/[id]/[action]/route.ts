import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/jobQueue';
import { getSignedDownloadUrl } from '@/lib/s3';
import { updateJob, getJob } from '@/lib/jobsDB';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  const job = await jobQueue.getJob(id);
  if (!job) return new NextResponse('not found', { status: 404 });

  if (action === 'cancel') {
    await job.remove();
    updateJob(id, { step: 'cancelled' });
  } else if (action === 'stop') {
    await job.moveToFailed(new Error('stopped by user'), true);
    updateJob(id, { step: 'stopped' });
  } else if (action === 'retry') {
    await job.retry();
    updateJob(id, { step: 'queued', progress: 0 });
  } else {
    return new NextResponse('unknown action', { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  if (action !== 'download') return new NextResponse('not found', { status: 404 });
  const keyMp4 = `jobs/${id}/result.mp4`;
  const keyZip = `jobs/${id}/result.zip`;
  try {
    const url = await getSignedDownloadUrl(keyMp4).catch(() => getSignedDownloadUrl(keyZip));
    return NextResponse.json({ url });
  } catch (e) {
    return new NextResponse('not found', { status: 404 });
  }
}
