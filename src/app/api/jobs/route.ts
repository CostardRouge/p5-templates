import { listJobs } from '@/lib/jobsDB';

export async function GET() {
  return Response.json(listJobs());
}
