export type JobId = string;

export type JobStatusEnum = "queued" | "active" | "completed" | "failed" | "cancelled"

/**
 * TypeScript type matching the Prisma Job model.
 */
export type JobModel = {
  id: JobId;
  template: string;
  status: JobStatusEnum,
  progress: number; // 0–100
  resultUrl: string | null;
  optionsKey: string | null;
  fileKeys: string[] | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RecordingSketchSlideOption = {
  template: string
}

export type RecordingSketchOptions = {
  slides?: Array<RecordingSketchSlideOption>
}

export type RecordingProgressionSteps = Record<string, {
  percentage: number,
  description?: string
} | RecordingProgressionNestedSteps>;

export type RecordingProgressionNestedSteps = {
  description?: string,
  steps: RecordingProgressionSteps,
}

export type RecordingStatus = {
  status: string,
  steps?: RecordingProgressionSteps,
}

export interface RecordingJobData {
  jobId: string;
  template: string;
}

export interface JobConfiguration {
  jobId: string;
  removeOnComplete: number;
  removeOnFail: number,
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
  formData: FormData;
}

export interface EnqueueRecordingResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

export type RecordingProgressionStream = {
  currentStep: {
    name: string;
    progression: number;
  } | null;
  percentage: number;
} & RecordingStatus;