import IORedis from 'ioredis';
import { Queue, Worker, Job } from 'bullmq';
import runRecording from './runRecording';
import { setProgress } from './progressStore';
import { uploadFile } from './s3';
import fs from 'node:fs/promises';
import path from 'path';

export interface JobAsset {
  name: string;
  buffer: Buffer;
  type?: string;
}

export interface JobData {
  template: string;
  options: any;
  assets: JobAsset[];
}

const connection = new IORedis(process.env.REDIS_URL ?? {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD ?? undefined,
});

export const jobQueue = new Queue<JobData>('render-jobs', { connection });

export const worker = new Worker<JobData>(
  'render-jobs',
  async job => {
    setProgress(job.id, 'processing', 10);
    const outputPath = await runRecording(job.id, job.data.template, {
      options: job.data.options,
      assets: job.data.assets,
    });

    const ext = path.extname(outputPath);
    const contentType = ext === '.zip' ? 'application/zip' : 'video/mp4';
    const data = await fs.readFile(outputPath);
    const key = `jobs/${job.id}/result${ext}`;
    await uploadFile(key, data, contentType);
    return { key };
  },
  { connection }
);

worker.on('completed', job => {
  setProgress(job.id, 'done', 100);
});

worker.on('failed', (job, err) => {
  console.error('job failed', job?.id, err);
  if (job) setProgress(job.id, 'error', 100);
});

