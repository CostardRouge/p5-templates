import {
  JsonValue
} from "@prisma/client/runtime/library";

import {
  PrismaClient, Job
} from "@/generated/prisma";
import {
  InputJsonValue
} from "@prisma/client/runtime/edge";
import slides from "../../public/assets/scripts/p5-sketches/utils/slides/slides";

export type JobId = string;

export const validStatuses = [
  "queued",
  "active",
  "completed",
  "failed",
  "cancelled",
  "draft"
] as const;

export type JobStatusEnum = typeof validStatuses[number];

// export type JobStatusEnum = "queued" | "active" | "completed" | "failed" | "cancelled" | "draft"

/**
 * TypeScript type matching the Prisma Job model.
 */
export type JobModel = {
  id: JobId;
  template: string;
  status: JobStatusEnum,
  progress: number; // 0–100
  resultUrl: string | null;
  options: InputJsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SketchAssets = {
  images: string[],
  videos: string[],
  audios: string[],
  json: string[]
}

export type RecordingSketchSlideOption = {
  title: string;
  template: string,
  assets: SketchAssets
}

export type RecordingSketchOptions = {
  id: string;
  name: string;
  assets: SketchAssets;
  slides?: Array<RecordingSketchSlideOption>;
  consumeTestImages?: boolean;
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

/* Map filename → object-URL   (lives only for the browser session) */
type BlobMap = Record<string, string>;

declare global { interface Window {
  // Assets
 __blobAssetMap?: BlobMap
  // Recorder
  startLoopRecording: () => void
  stopRecording: () => void
  // Slides
  setSlide: ( index: number ) => void
  getSlide: ( index: number ) => RecordingSketchSlideOption
  getCurrentSlide: () => {
    slide: RecordingSketchSlideOption
    index: number
  };
  // Script loader
  removeLoadedScripts: () => void
} }
