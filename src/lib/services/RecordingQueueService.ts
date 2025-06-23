import {
  Queue
} from "bullmq";
import {
  v4 as generateUuid
} from "uuid";
import Redis from "@/lib/connections/redis";
import {
  createJob, updateJob
} from "@/lib/jobStore";
import {
  RecordingJobData,
  JobConfiguration,
  QueueHealthResponse
} from "@/types/recording.types";
import {
  uploadArtifact
} from "@/lib/connections/s3";
import {
  addRecordingStatus
} from "@/lib/progression";

export class RecordingQueueService {
  private static instance: RecordingQueueService | null = null;
  private readonly queue: Queue<RecordingJobData>;

  private readonly DEFAULT_JOB_OPTIONS: Omit<JobConfiguration, "jobId"> = {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 1,
    backoff: {
      type: "exponential",
      delay: 30_000,
    },
  };

  private constructor() {
    this.queue = new Queue<RecordingJobData>(
      "recording-queue",
      {
        connection: Redis.getInstance(),
        defaultJobOptions: {
          removeOnComplete: this.DEFAULT_JOB_OPTIONS.removeOnComplete,
          removeOnFail: this.DEFAULT_JOB_OPTIONS.removeOnFail,
          attempts: this.DEFAULT_JOB_OPTIONS.attempts,
          backoff: this.DEFAULT_JOB_OPTIONS.backoff,
        },
      }
    );

    // Handle queue events
    this.queue.on(
      "error",
      ( error ) => {
        console.error(
          "[Queue] Error:",
          error
        );
      }
    );
  }

  public static getInstance(): RecordingQueueService {
    if ( !RecordingQueueService.instance ) {
      RecordingQueueService.instance = new RecordingQueueService();
    }

    return RecordingQueueService.instance;
  }

  public async enqueueRecording(
    template: string,
    options :string,
    files: File[]
  ): Promise<string> {
    const jobId = generateUuid();

    try {
      // 1. Create job record in database first
      const persistedJob = await createJob(
        jobId,
        template,
        "queued"
      );

      await addRecordingStatus(
        jobId,
        persistedJob.status
      );

      // 2. Persisting files in s3
      for ( const file of files ) {
        await uploadArtifact(
          `${ jobId }/assets/${ file.name }`,
          Buffer.from( new Uint8Array( await file.arrayBuffer() ) )
        );
      }

      // 3. Persisting options in s3
      await uploadArtifact(
        `${ jobId }/options.json`,
        Buffer.from( options )
      );

      await updateJob(
        jobId,
        {
          options: JSON.parse( options )
        }
      );

      // 3. Add job to BullMQ queue
      await this.queue.add(
        "process-recording",
        {
          jobId,
          template
        },
        {
          jobId,
          priority: 1,
          delay: 0,
          removeOnFail: true,
          removeOnComplete: true
        }
      );

      console.log( `[Queue] Recording job enqueued: ${ jobId }` );
      return jobId;
    } catch ( error ) {
      console.error(
        `[Queue] Failed to enqueue job ${ jobId }:`,
        error
      );
      throw new Error( `Failed to enqueue recording job: ${ error instanceof Error ? error.message : "Unknown error" }` );
    }
  }

  public async getQueueHealth(): Promise<QueueHealthResponse> {
    try {
      const [
        waiting,
        active,
        completed,
        failed
      ] = await Promise.all( [
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
      ] );

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      };
    } catch ( error ) {
      console.error(
        "[Queue] Error getting health status:",
        error
      );
      throw error;
    }
  }

  public async pauseQueue(): Promise<void> {
    await this.queue.pause();
    console.log( "[Queue] Paused" );
  }

  public async resumeQueue(): Promise<void> {
    await this.queue.resume();
    console.log( "[Queue] Resumed" );
  }

  public async closeQueue(): Promise<void> {
    try {
      await this.queue.close();
      console.log( "[Queue] Closed successfully" );
    } catch ( error ) {
      console.error(
        "[Queue] Error closing:",
        error
      );
      throw error;
    }
  }

  public getQueue(): Queue<RecordingJobData> {
    return this.queue;
  }
}