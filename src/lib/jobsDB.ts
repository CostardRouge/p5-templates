import { LowSync, JSONFileSync } from 'lowdb/node';
import { join } from 'path';

export interface JobRecord {
  id: string;
  template: string;
  step: string;
  progress: number;
  resultKey?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface Data {
  jobs: Record<string, JobRecord>;
}

const file = process.env.DB_PATH ?? join(process.cwd(), 'jobs.json');
const adapter = new JSONFileSync<Data>(file);
const db = new LowSync(adapter);
db.read();
if (!db.data) db.data = { jobs: {} };

export function createJob(job: JobRecord) {
  db.data!.jobs[job.id] = job;
  db.write();
}

export function updateJob(id: string, fields: Partial<JobRecord>) {
  const j = db.data!.jobs[id];
  if (!j) return;
  Object.assign(j, fields, { updatedAt: Date.now() });
  db.write();
}

export function getJob(id: string) {
  return db.data!.jobs[id];
}

export function listJobs() {
  return Object.values(db.data!.jobs).sort((a, b) => b.createdAt - a.createdAt);
}
