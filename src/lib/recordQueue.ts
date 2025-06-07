import {
  Queue, Worker, Job
} from "bullmq";
import IORedis from "ioredis";
import {
  v4 as uuidV4
} from "uuid";

import runRecording from "@/lib/runRecording";
import {
  createJob, updateJob
} from "@/lib/jobStore";
import {
  setProgress
} from "@/lib/progressStore";

/* ---------- Redis connection ---------- */

const redisUrl: string | undefined = process.env.REDIS_URL;

if ( !redisUrl ) {
  throw new Error( "REDIS_URL env var is missing" );
}

const redisConnection = new IORedis(
  redisUrl,
  {
    maxRetriesPerRequest: null,
  }
);

/* ---------- Queue ---------- */

export interface RecordingJobData {
  template: string;
  /** formData should be serializable (e.g. JSON fields + base64 assets) */
  formData: Record<string, unknown>;
}

export const recordQueue = new Queue<RecordingJobData>(
  "record",
  {
    connection: redisConnection
  }
);

/* ---------- Enqueue helper ---------- */

export async function enqueueRecording(
  template: string,
  serialisedFormData: Record<string, unknown>
): Promise<string> {
  const jobId = uuidV4();

  // 1. Persist a Job row immediately
  await createJob(
    jobId,
    template
  );

  // 2. Add to BullMQ (no QueueScheduler required)
  await recordQueue.add(
    "record",
    {
      template,
      formData: serialisedFormData
    },
    {
      jobId,
      removeOnComplete: 100,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 30_000
      }
    }
  );

  return jobId;
}

/* ---------- Worker ---------- */

export const recordWorker = new Worker<RecordingJobData>(
  "record",
  async( job: Job<RecordingJobData> ) => {
    // Mark job as active in database
    await updateJob(
      job.id as string,
      {
        status: "active",
        progress: 0
      }
    );

    // Run the recording logic (progress updates inside runRecording)
    await runRecording(
      job.id as string,
      job.data.template,
      job.data.formData
    );
  },
  {
    connection: redisConnection,
    concurrency: parseInt(
      process.env.WORKER_CONCURRENCY ?? "2",
      10
    ),
    // Worker’s built-in stalled job checks replace the old QueueScheduler
    stalledInterval: 30000, // check for stalled jobs every 30 sec
    maxStalledCount: 1
  }
);

/* ---------- Worker event hooks ---------- */

recordWorker.on(
  "completed",
  async( job: Job ) => {
    await setProgress(
      job.id as string,
      "completed",
      100
    );
  }
);

recordWorker.on(
  "failed",
  async(
    job?: Job, error?: Error
  ) => {
    await setProgress(
      job?.id as string,
      "failed",
      100
    );

    console.error(
      "[recordWorker] job failed",
      job?.id,
      error
    );
  }
);

/* ---------- Graceful shutdown ---------- */

process.on(
  "SIGTERM",
  async() => {
    console.log( "Graceful shutdown initiated for worker" );

    await recordWorker.close();
    await recordQueue.close();

    process.exit( 0 );
  }
);
