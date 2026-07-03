import type {
  Prisma
} from "@/generated/prisma";

import type {
  SlideOption
} from "@/types/sketch.types";

export type JobId = string;

export const validStatuses = [
  "queued",
  "active",
  "completed",
  "failed",
  "cancelled",
  "draft"
] as const;

export type JobStatusEnum = ( typeof validStatuses )[ number ];

/**
 * TypeScript type matching the Prisma Job model.
 */
export type JobModel = {
  id: JobId;
  snapshotId: string | null;
  template: string;
  status: JobStatusEnum;
  progress: number; // 0–100
  resultUrl: string | null;
  thumbnails: Prisma.JsonValue; // Array of thumbnail URLs stored as JSON
  videoUrls: Prisma.JsonValue; // Array of video URLs for multi-slide recordings stored as JSON
  videoSizes: Prisma.JsonValue; // Array of video file sizes in bytes stored as JSON
  recordingStartAt: Date | null; // When recording processing started
  recordingEndAt: Date | null; // When recording processing completed
  recordingDuration: number | null; // Recording duration in milliseconds
  options: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

export type RecordingProgressionSteps = Record<
  string,
  | {
    percentage: number;
    description?: string;
  }
  | RecordingProgressionNestedSteps
>;

export type RecordingProgressionNestedSteps = {
  description?: string;
  steps: RecordingProgressionSteps;
};

export type RecordingStatus = {
  status: string;
  steps?: RecordingProgressionSteps;
  recordingDuration?: number;
  currentSlideIndex?: number;
};

export interface RecordingJobData {
  jobId: string;
  template: string;
}

export interface JobConfiguration {
  jobId: string;
  removeOnComplete: number;
  removeOnFail: number;
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

declare global {
  interface Window {
    // p5
    noLoop(): () => void;
    redraw(): () => void;
    loop(): () => void;
    frameRate( fps: number ): void;

    // Assets
    __blobAssetMap?: BlobMap;
    // Slides
    slides: {
      index: number;
      current: SlideOption;
    };
    setSlide: ( index: number ) => void;
    getSlide: ( index: number ) => SlideOption;
    getCurrentSlide: () => {
      slide: SlideOption;
      index: number;
    };
    // Running sketch identity, published by the React SketchContext provider so
    // the runtime (e.g. the HUD badge) can print the name / engine / category.
    getSketchInfo?: () => {
      name: string;
      engine: string;
      category: string;
    };
    // Script loader
    removeLoadedScripts: () => void;

    // P5 sketch controls
    toggleLoop: () => void;
    toggleFPS: () => void;
    saveCanvas: ( name: string ) => void;

    // P5 animation progression controls
    setAnimationProgression: ( progression: number ) => void;
    getAnimationProgression: () => number;

    // Server-side / deterministic recording controls (time utility)
    enableRecordingMode?: () => void;
    disableRecordingMode?: () => void;
    // Pin the deterministic recording clock to an explicit frame index so the
    // next redraw renders at exactly frame / framerate seconds. Set before
    // every captured frame by both the client async-loop recorder and the
    // server capture controller, keeping the sketch clock in lock-step with
    // the encoder's frame timestamps regardless of wall-clock render speed.
    setRecordingFrame?: ( frame: number ) => void;

    // Interaction vision readiness (set by the interaction layer). Returns true
    // once the vision source has loaded and produced a first result, or when no
    // vision is needed. Awaited before capture so a recording never starts mid
    // warm-up.
    isInteractionVisionReady?: () => boolean;
  }
}
