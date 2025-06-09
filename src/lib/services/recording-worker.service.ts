import {
  Worker, Job
} from "bullmq";
import RedisConnection from "@/lib/redis-connection";
import {
  updateJob
} from "@/lib/jobStore";
import {
  setProgress
} from "@/lib/progressStore";
import runRecording from "@/lib/runRecording";
import {
  RecordingJobData
} from "@/types/recording.types";

export class RecordingWorkerService {
  private static instance: RecordingWorkerService | null = null;
  private readonly worker: Worker<RecordingJobData>;
  private readonly concurrency: number;

  private constructor() {
    this.concurrency = this.getWorkerConcurrency();
    this.worker = this.initializeWorker();
    this.setupEventHandlers();
  }

  public static getInstance(): RecordingWorkerService {
    if ( !RecordingWorkerService.instance ) {
      RecordingWorkerService.instance = new RecordingWorkerService();
    }
    return RecordingWorkerService.instance;
  }

  private getWorkerConcurrency(): number {
    const envConcurrency = process.env.WORKER_CONCURRENCY;
    const defaultConcurrency = 2;

    if ( !envConcurrency ) {
      return defaultConcurrency;
    }

    const parsedConcurrency = parseInt(
      envConcurrency,
      10
    );

    if ( isNaN( parsedConcurrency ) || parsedConcurrency < 1 ) {
      console.warn( `[Worker] Invalid WORKER_CONCURRENCY value: ${ envConcurrency }, using default: ${ defaultConcurrency }` );
      return defaultConcurrency;
    }

    return parsedConcurrency;
  }

  private initializeWorker(): Worker<RecordingJobData> {
    return new Worker<RecordingJobData>(
      "recording-queue",
      this.processRecordingJob.bind( this ),
      {
        connection: RedisConnection.getInstance(),
        concurrency: this.concurrency,
        stalledInterval: 30_000, // Check for stalled jobs every 30 seconds
        maxStalledCount: 1,
        removeOnComplete: {
          count: 100
        },
        removeOnFail: {
          count: 50
        },
      }
    );
  }

  private async processRecordingJob( job: Job<RecordingJobData> ): Promise<void> {
    const jobId = job.id as string;

    if ( !jobId ) {
      throw new Error( "Job ID is required" );
    }

    try {
      console.log( `[Worker] Processing job: ${ jobId }` );

      // Update job status to active
      await updateJob(
        jobId,
        {
          status: "active",
          progress: 0,
        }
      );

      // Process the recording
      await runRecording(
        jobId,
        job.data.template,
        job.data.formData
      );

      console.log( `[Worker] Job completed successfully: ${ jobId }` );
    } catch ( error ) {
      console.error(
        `[Worker] Job processing failed: ${ jobId }`,
        error
      );

      // Update job status to failed
      await updateJob(
        jobId,
        {
          status: "failed",
          progress: 0,
        }
      );

      throw error; // Re-throw to let BullMQ handle retry logic
    }
  }

  private setupEventHandlers(): void {
    this.worker.on(
      "completed",
      this.handleJobCompleted.bind( this )
    );
    this.worker.on(
      "failed",
      this.handleJobFailed.bind( this )
    );
    this.worker.on(
      "error",
      this.handleWorkerError.bind( this )
    );
    this.worker.on(
      "stalled",
      this.handleStalledJob.bind( this )
    );
  }

  private async handleJobCompleted( job: Job ): Promise<void> {
    const jobId = job.id as string;

    try {
      await setProgress(
        jobId,
        "completed",
        100
      );
      console.log( `[Worker] Job completed: ${ jobId }` );
    } catch ( error ) {
      console.error(
        `[Worker] Error updating completed job: ${ jobId }`,
        error
      );
    }
  }

  private async handleJobFailed(
    job?: Job, error?: Error
  ): Promise<void> {
    const jobId = job?.id as string;

    if ( !jobId ) {
      console.error(
        "[Worker] Job failed without ID",
        error?.message
      );
      return;
    }

    try {
      await setProgress(
        jobId,
        "failed",
        0
      );
      console.error( `[Worker] Job failed: ${ jobId } - ${ error?.message }` );
    } catch ( updateError ) {
      console.error(
        `[Worker] Error updating failed job: ${ jobId }`,
        updateError
      );
    }
  }

  private handleWorkerError( error: Error ): void {
    console.error(
      "[Worker] Worker error:",
      error
    );
  }

  private handleStalledJob( jobId: string ): void {
    console.warn( `[Worker] Job stalled: ${ jobId }` );
  }

  public async pauseWorker(): Promise<void> {
    await this.worker.pause();
    console.log( "[Worker] Paused" );
  }

  public async resumeWorker(): Promise<void> {
    this.worker.resume();
    console.log( "[Worker] Resumed" );
  }

  public async closeWorker(): Promise<void> {
    try {
      await this.worker.close();
      console.log( "[Worker] Closed successfully" );
    } catch ( error ) {
      console.error(
        "[Worker] Error closing worker:",
        error
      );
      throw error;
    }
  }

  public getWorker(): Worker<RecordingJobData> {
    return this.worker;
  }
}