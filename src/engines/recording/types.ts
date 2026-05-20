/* ------------------------------------------------------------------ */
/*  Engine-agnostic client-side recording                              */
/* ------------------------------------------------------------------ */

/**
 * Supported output container formats. Encoders are registered per format;
 * a given format may only be available in some modes (e.g. `gif` is
 * deterministic-only, `webm` works in both).
 */
export type RecordingFormat = "webm" | "gif" | "mp4";

/**
 * `realtime`   – wall-clock capture via MediaRecorder on
 *                `canvas.captureStream()`. Honors interactivity and
 *                non-deterministic sources (mouse, audio, `millis()`).
 *                Duration == real elapsed time; frame drops possible.
 *
 * `async-loop` – step through every frame via `host.seekAndDraw(i)`
 *                and feed pixels to an encoder. Exact frame timing,
 *                slow on heavy sketches, requires the sketch to be
 *                reproducible from `frameCount`.
 */
export type RecordingMode = "realtime" | "async-loop";

export type RecorderProgressStage = "capturing" | "encoding" | "finalizing";

export type RecorderProgress = {
  frame: number;
  totalFrames: number;
  percentage: number;
  stage: RecorderProgressStage;
};

export type RecorderResult = {
  blob: Blob;
  mimeType: string;
  fileExtension: string;
};

export type RecorderEventMap = {
  start: void;
  progress: RecorderProgress;
  stop: RecorderResult;
  error: Error;
  cancel: void;
};

export type RecorderEventName = keyof RecorderEventMap;

/**
 * Declared by each engine through `SketchEngine.getRecordingCapabilities()`.
 * Lets the UI pick a sensible default mode + disable formats that don't
 * apply to the current sketch.
 */
export type RecorderCapabilities = {
  /** Engine can render arbitrary frame indices reproducibly. */
  supportsDeterministicCapture: boolean;
  /** Suggested default for this engine + current sketch. */
  defaultMode: RecordingMode;
  /** Formats the engine considers viable in `defaultMode`. */
  supportedFormats: RecordingFormat[];
};

/**
 * Narrow contract a `Recorder` consumes — anything that exposes a canvas
 * and (for deterministic mode) frame controls. Decouples the recorder
 * from `SketchEngine` so it can be reused by non-engine hosts (tests,
 * standalone canvases) without dragging in the full engine interface.
 */
export interface RecorderHost {
  getCanvas(): HTMLCanvasElement | null;
  /**
   * Seek + render one frame synchronously enough that the canvas
   * reflects frame index by the time the promise resolves.
   * Only required for async-loop mode.
   */
  seekAndDraw( frame: number ): Promise<void>;
  /**
   * Reset progression to frame 0 (frame counter + animation bridge).
   * Called before every recording so loops start from the beginning.
   */
  resetToStart(): Promise<void>;
  /** Stop the host's own draw loop during async-loop capture. */
  pause(): void;
  resume(): void;
  /** Resolved frame count for the active sketch. */
  readonly totalFrames: number;
  /** Resolved frames-per-second for the active sketch. */
  readonly frameRate: number;
}

export type RecorderStartOptions = {
  /** Filename without extension. The encoder appends the right one. */
  filename?: string;
  /** Realtime: max wall-clock duration before auto-stop. */
  maxDurationMs?: number;
  /** Realtime: target bits-per-second. Deterministic: encoder-specific. */
  videoBitsPerSecond?: number;
};

/**
 * A configured recorder bound to a host, mode and format. The factory
 * decides everything that's static for the run; `start()` only triggers
 * the actual capture.
 */
export interface Recorder {
  readonly mode: RecordingMode;
  readonly format: RecordingFormat;
  readonly isRecording: boolean;

  start( options?: RecorderStartOptions ): Promise<void>;
  stop(): Promise<RecorderResult>;
  cancel(): void;

  on<E extends RecorderEventName>(
    event: E,
    handler: ( payload: RecorderEventMap[ E ] ) => void,
  ): void;
  off<E extends RecorderEventName>(
    event: E,
    handler: ( payload: RecorderEventMap[ E ] ) => void,
  ): void;
}

/**
 * Per-format encoder. Strategies (realtime/deterministic) instantiate
 * one of these and push frames or stream data into it.
 */
export interface FrameEncoder {
  readonly format: RecordingFormat;
  readonly mimeType: string;
  readonly fileExtension: string;
  /** Push one frame in deterministic mode. No-op in realtime mode. */
  addFrame( source: CanvasImageSource ): Promise<void>;
  /** Finalize and return the produced blob. */
  finalize(): Promise<Blob>;
  /** Discard buffered data + free workers. */
  dispose(): void;
}

export type FrameEncoderFactory = ( params: {
  width: number;
  height: number;
  frameRate: number;
  totalFrames: number;
  videoBitsPerSecond?: number;
} ) => FrameEncoder;
