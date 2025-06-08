import {
  Queue, Worker, Job
} from "bullmq";
import IORedis from "ioredis";
import {
  v4 as uuidV4
} from "uuid";
import {
  createJob, updateJob
} from "@/lib/jobStore";
import {
  setProgress
} from "@/lib/progressStore";
import runRecording from "@/lib/runRecording";

// ========== Constants ==========
const REDIS_URL = process.env.REDIS_URL as string;
const WORKER_CONCURRENCY = parseInt(
  process.env.WORKER_CONCURRENCY || "2",
  10
);
const JOB_ATTEMPTS = 3;
const JOB_BACKOFF_DELAY_MS = 30_000;
const JOB_REMOVE_ON_COMPLETE_COUNT = 100;
const WORKER_STALLED_INTERVAL_MS = 30_000;
const WORKER_MAX_STALLED_COUNT = 1;

// ========== Types ==========
export interface RecordingJobData {
  template: string;
  formData: Record<string, unknown>;
}

export enum JobStatus {
  QUEUED = "queued",
  ACTIVE = "active",
  COMPLETED = "completed",
  FAILED = "failed",
}

// ========== Redis Connection ==========
function createRedisConnection() {
  if ( !REDIS_URL ) throw new Error( "REDIS_URL environment variable is required" );

  return new IORedis(
    REDIS_URL,
    {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      commandTimeout: 5000,
      reconnectOnError: ( err ) => {
        console.warn(
          "Redis connection error",
          err.message
        );
        return true;
      },
    }
  );
}

const redisConnection = createRedisConnection();

// ========== Queue Setup ==========
export const recordingQueue = new Queue<RecordingJobData>(
  "recordingQueue",
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: JOB_REMOVE_ON_COMPLETE_COUNT,
      attempts: JOB_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: JOB_BACKOFF_DELAY_MS,
      },
    },
  }
);

// ========== Queue Operations ==========
export async function enqueueRecordingJob(
  template: string,
  formData: Record<string, unknown>
): Promise<string> {
  const jobId = uuidV4();

  await createJob(
    jobId,
    template
  );

  await recordingQueue.add(
    "processRecording",
    {
      template,
      formData,
    },
    {
      jobId,
      priority: 1, // Higher priority jobs get processed first
    }
  );

  return jobId;
}

// ========== Worker Setup ==========
export const recordingWorker = new Worker<RecordingJobData>(
  "recordingQueue",
  async( job: Job<RecordingJobData> ) => {
    try {
      await updateJob(
       job.id!,
       {
         status: JobStatus.ACTIVE,
         progress: 0,
       }
      );

      await runRecording(
        job.id!,
        job.data.template,
        job.data.formData
      );
    } catch ( error ) {
      await updateJob(
        job.id!,
        {
          status: JobStatus.FAILED,
          error: ( error as Error ).message,
        }
      );
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: WORKER_CONCURRENCY,
    stalledInterval: WORKER_STALLED_INTERVAL_MS,
    maxStalledCount: WORKER_MAX_STALLED_COUNT,
    removeOnComplete: {
      // age: JOB_REMOVE_ON_COMPLETE_COUNT,
      count: JOB_REMOVE_ON_COMPLETE_COUNT
    },
    lockDuration: 120_000, // 2 minute lock
  }
);

// ========== Worker Event Handlers ==========
recordingWorker.on(
  "completed",
  async( job: Job ) => {
    await updateJob(
 job.id!,
 {
   status: JobStatus.COMPLETED,
   progress: 100,
 }
    );
  }
);

recordingWorker.on(
  "failed",
  async(
    job?: Job, error?: Error
  ) => {
    if ( !job ) return;

    await updateJob(
      job.id!,
      {
        status: JobStatus.FAILED,
        error: error?.message || "Unknown error",
      }
    );
  }
);

recordingWorker.on(
  "error",
  ( error: Error ) => {
    console.error(
      "Worker error:",
      error.message
    );
  }
);

// ========== Graceful Shutdown ==========
const shutdownHandlers = {
  async gracefulShutdown() {
    console.log( "Starting graceful shutdown..." );

    try {
      await recordingWorker.close();
      await recordingQueue.close();
      await redisConnection.quit();

      console.log( "Resources released successfully" );
      process.exit( 0 );
    } catch ( error ) {
      console.error(
        "Shutdown error:",
        ( error as Error ).message
      );
      process.exit( 1 );
    }
  },

  initialize() {
    process.on(
      "SIGTERM",
      () => {
        console.log( "SIGTERM" );
        this.gracefulShutdown();
      }
    );
    process.on(
      "SIGINT",
      () => {
        console.log( "SIGINT" );
        this.gracefulShutdown();
      }
    );
    process.on(
      "uncaughtException",
      ( error ) => {
        console.error(
          "Uncaught Exception:",
          error
        );

        console.log( "uncaughtException" );
        this.gracefulShutdown();
      }
    );
  },
};

// shutdownHandlers.initialize();