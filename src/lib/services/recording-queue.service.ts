import {
  Queue
} from "bullmq";
import {
  v4 as generateUuid
} from "uuid";
import RedisConnection from "@/lib/redis-connection";
import {
  createJob
} from "@/lib/jobStore";
import {
  RecordingJobData,
  JobConfiguration,
  QueueHealthResponse
} from "@/types/recording.types";

export class RecordingQueueService {
  private static instance: RecordingQueueService | null = null;
  private readonly queue: Queue<RecordingJobData>;

  private readonly DEFAULT_JOB_OPTIONS: Omit<JobConfiguration, "jobId"> = {
    removeOnComplete: 100,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 30_000,
    },
  };

  private constructor() {
    this.queue = new Queue<RecordingJobData>(
      "recording-queue",
      {
        connection: RedisConnection.getInstance(),
        defaultJobOptions: {
          removeOnComplete: this.DEFAULT_JOB_OPTIONS.removeOnComplete,
          removeOnFail: 50,
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
    serializedFormData: Record<string, unknown>
  ): Promise<string> {
    const jobId = generateUuid();

    try {
      // 1. Create job record in database first
      await createJob(
        jobId,
        template
      );

      // 2. Add job to BullMQ queue
      await this.queue.add(
        "process-recording",
        {
          template,
          formData: serializedFormData,
        },
        {
          jobId,
          priority: 1,
          delay: 0,
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