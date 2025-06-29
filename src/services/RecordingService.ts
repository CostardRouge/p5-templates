import {
  RecordingQueueService
} from "./RecordingQueueService";
import {
  RecordingWorkerService
} from "./RecordingWorkerService";
import Redis from "@/lib/connections/redis";
import {
  QueueHealthResponse
} from "@/types/recording.types";

export class RecordingService {
  private static instance: RecordingService | null = null;
  private readonly queueService: RecordingQueueService;
  private readonly workerService: RecordingWorkerService;

  private constructor() {
    this.queueService = RecordingQueueService.getInstance();
    this.workerService = RecordingWorkerService.getInstance();

    this.setupSignalHandlers();
  }

  public static getInstance(): RecordingService {
    if ( !RecordingService.instance ) {
      RecordingService.instance = new RecordingService();
    }
    return RecordingService.instance;
  }

  public async enqueueRecording(
    template: string,
    options: string,
    files: File[]
  ): Promise<string> {
    return this.queueService.enqueueRecording(
      template,
      options,
      files
    );
  }

  public async getQueueHealth(): Promise<QueueHealthResponse> {
    return this.queueService.getQueueHealth();
  }

  public async pauseProcessing(): Promise<void> {
    await Promise.all( [
      this.queueService.pauseQueue(),
      this.workerService.pauseWorker(),
    ] );
  }

  public async resumeProcessing(): Promise<void> {
    await Promise.all( [
      this.queueService.resumeQueue(),
      this.workerService.resumeWorker(),
    ] );
  }

  public async shutdown(): Promise<void> {
    console.log( "[Service] Initiating graceful shutdown..." );

    try {
      await Promise.all( [
        this.workerService.closeWorker(),
        this.queueService.closeQueue(),
      ] );

      await Redis.disconnect();

      console.log( "[Service] Graceful shutdown completed" );
    } catch ( error ) {
      console.error(
        "[Service] Error during shutdown:",
        error
      );
      throw error;
    }
  }

  private setupSignalHandlers(): void {
    process.on(
      "SIGTERM",
      this.shutdown.bind( this )
    );
    process.on(
      "SIGINT",
      this.shutdown.bind( this )
    );

    process.on(
      "unhandledRejection",
      (
        reason, promise
      ) => {
        console.error(
          "Unhandled Rejection at:",
          promise,
          "reason:",
          reason
        );
      }
    );

    process.on(
      "uncaughtException",
      async( error ) => {
        console.error(
          "Uncaught Exception:",
          error
        );
        await this.shutdown();
      }
    );
  }
}