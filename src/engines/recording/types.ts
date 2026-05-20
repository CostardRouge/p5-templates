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
 * Engine-agnostic capture surface.
 *
 * Decouples the recorder from any assumption that a sketch renders into a
 * `<canvas>`. Canvas engines (p5, three.js) expose their live canvas
 * directly; DOM/CSS engines (GSAP/HTML) expose a *mirror* canvas that is
 * (re)painted from the rendered DOM on demand. Either way the recorder
 * only ever talks to this interface, never a raw canvas.
 */
export interface CaptureSource {
  /** Pixel width of the captured surface. */
  readonly width: number;
  /** Pixel height of the captured surface. */
  readonly height: number;

  /**
   * A `<canvas>` suitable for `MediaRecorder.captureStream()` (realtime)
   * and as the backing canvas for WebCodecs encoders. For canvas engines
   * this is the live canvas; for DOM engines it's the mirror canvas that
   * `beginRealtime()` keeps continuously repainted.
   */
  getStreamCanvas(): HTMLCanvasElement | null;

  /**
   * Ensure the stream canvas reflects the *current* frame and return a
   * drawable image source for it. Cheap (identity) for canvas engines;
   * for DOM engines this rasterises the current DOM into the mirror
   * canvas. Called by async-loop capture after each `seekAndDraw`.
   */
  readFrame(): Promise<CanvasImageSource>;

  /**
   * Begin continuously mirroring the rendered output into the stream
   * canvas (DOM engines start a rAF rasterise loop). No-op for canvas
   * engines whose canvas is already live. Called when realtime capture
   * starts.
   */
  beginRealtime(): void;

  /** Stop the continuous mirror loop started by `beginRealtime()`. */
  endRealtime(): void;
}

/**
 * Narrow contract a `Recorder` consumes — anything that exposes a capture
 * surface and (for deterministic mode) frame controls. Decouples the
 * recorder from `SketchEngine` so it can be reused by non-engine hosts
 * (tests, standalone surfaces) without dragging in the full engine
 * interface.
 */
export interface RecorderHost {
  /** Engine-agnostic capture surface (canvas or DOM-mirror). */
  getCaptureSource(): CaptureSource;
  /**
   * Convenience accessor for the underlying stream canvas. Equivalent to
   * `getCaptureSource().getStreamCanvas()`; kept for callers that only
   * need a canvas reference (e.g. saving a still image).
   */
  getCanvas(): HTMLCanvasElement | null;
  /**
   * Seek + render one frame synchronously enough that the surface
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

/* ------------------------------------------------------------------ */
/*  Server-side (Playwright) capture                                   */
/* ------------------------------------------------------------------ */

/**
 * How the headless recorder should grab a frame from the page.
 *
 * `canvas` – read `<canvas>.toDataURL()` (fast, exact pixels).
 * `dom`    – take a Playwright element screenshot of the rendered DOM
 *            surface (works for CSS/HTML/GSAP engines that have no canvas).
 */
export type ServerCaptureKind = "canvas" | "dom";

/**
 * Registered by the active engine on `window.__sketchCapture` once it is
 * ready, so the headless recording pipeline can drive *any* engine through
 * one uniform protocol instead of hard-coding p5 globals + `canvas.p5Canvas`.
 *
 * The pipeline calls `prepare()` once, then `renderFrame(i)` per frame, then
 * screenshots `surfaceSelector` (or reads the canvas) according to
 * `captureKind`.
 */
export interface ServerCaptureController {
  /** Whether frames are read from a canvas or screenshotted from the DOM. */
  captureKind: ServerCaptureKind;
  /** CSS selector of the element to capture (canvas or DOM stage). */
  surfaceSelector: string;
  /** Put the engine into deterministic, frame-stepped capture mode. */
  prepare(): void;
  /**
   * Render frame `index` deterministically. May be async (e.g. waiting for
   * a layout/paint). Implementations that auto-advance time can ignore the
   * argument.
   */
  renderFrame( index: number ): void | Promise<void>;
}
