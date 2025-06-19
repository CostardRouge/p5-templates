export type JobId = string;

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

export type RecordingStatusStorage = Record<JobId, RecordingStatus>

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