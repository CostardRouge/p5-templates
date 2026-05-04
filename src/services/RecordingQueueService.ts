import {
  Queue
} from "bullmq";
import {
  v4 as generateUuid
} from "uuid";
import Redis from "@/lib/connections/redis";
import {
  createJob, updateJob, getJobById
} from "@/lib/jobStore";
import {
  RecordingJobData,
  JobConfiguration,
  QueueHealthResponse,
  JobStatusEnum
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
      delay: 30_000
    }
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
          backoff: this.DEFAULT_JOB_OPTIONS.backoff
        }
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

  public async enqueueRecording( {
    template,
    options,
    status,
    files,
    jobId: providedJobId,
    thumbnails
  }: {
    status: JobStatusEnum;
    template: string;
    options: string;
    files: File[];
    jobId?: string;
    thumbnails?: Record<string, string>;
  } ): Promise<string> {
    const jobId = providedJobId ?? generateUuid();

    try {
      let persistedJob = await getJobById( jobId );

      // 1. Create job record in database first (if not existing)
      if ( !persistedJob ) {
        persistedJob = await createJob(
          jobId,
          template,
          status
        );
      }

      if ( persistedJob.status !== "draft" ) {
        await addRecordingStatus(
          jobId,
          persistedJob.status
        );
      }

      // 2. Persist assets in S3 (overwrite on upsert)
      for ( const file of files ) {
        await uploadArtifact(
          `${ jobId }/assets/${ file.name }`,
          Buffer.from( new Uint8Array( await file.arrayBuffer() ) )
        );
      }

      // 3. Persist options in S3 (overwrite)
      await uploadArtifact(
        `${ jobId }/options.json`,
        Buffer.from( options )
      );

      await updateJob(
        jobId,
        {
          options: JSON.parse( options ),
          ...( thumbnails
            ? {
              thumbnails
            }
            : {} )
        }
      );

      // 4. Enqueue if not draft
      if ( status !== "draft" ) {
        // Check if job is already in the queue
        const existingJob = await this.queue.getJob( jobId );

        if ( existingJob ) {
          const jobState = await existingJob.getState();

          // If job is already waiting or active, don't re-add it
          if ( [
            "waiting",
            "active",
            "delayed"
          ].includes( jobState ) ) {
            console.log( `[Queue] Job ${ jobId } already in queue with state: ${ jobState }` );
            return jobId;
          }

          // If job is in a terminal state, remove it before re-adding
          if ( [
            "completed",
            "failed"
          ].includes( jobState ) ) {
            await existingJob.remove();
          }
        }

        // ensure DB and SSE reflect queued state before worker picks it
        await updateJob(
          jobId,
          {
            status: "queued",
            progress: 0
          }
        );
        await addRecordingStatus(
          jobId,
          "queued"
        );

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
      }

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
        this.queue.getFailed()
      ] );

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
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
