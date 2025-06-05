import { jobQueue } from '@/lib/jobQueue';

export async function GET() {
  const jobs = await jobQueue.getJobs(['waiting','active','completed','failed']);
  const list = jobs.map(j => ({
    id: j.id,
    name: j.name,
    progress: j.progress,
    failedReason: j.failedReason ?? null,
    finishedOn: j.finishedOn,
    status: j.isCompleted() ? 'completed' : j.isFailed() ? 'failed' : j.isActive() ? 'active' : 'waiting'
  }));
  return Response.json(list);
}
