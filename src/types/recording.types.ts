export interface RecordingJobData {
  template: string;
  formData: Record<string, unknown>;
  userId?: string;
  metadata?: {
    name?: string;
    description?: string;
    createdAt: Date;
  };
}

export interface JobConfiguration {
  jobId: string;
  removeOnComplete: number;
  attempts: number;
  backoff: {
    type: "exponential";
    delay: number;
  };
}

export interface QueueHealthResponse {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface EnqueueRecordingRequest {
  template: string;
  formData: Record<string, unknown>;
}

export interface EnqueueRecordingResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}