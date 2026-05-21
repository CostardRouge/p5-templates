import type {
  SketchOption
} from "@/types/sketch.types";
import type {
  CaptureSource,
  RecorderCapabilities
} from "@/engines/recording/types";

/* ------------------------------------------------------------------ */
/*  Engine event system                                                */
/* ------------------------------------------------------------------ */

export type EngineEventMap = {
  /** Fired once when the engine has finished initialising and is ready. */
  ready: void;
  /** Fired on every rendered frame with the current frame index. */
  frame: number;
  /** Fired when the animation reaches its last frame (duration elapsed). */
  complete: void;
  /** Fired on any unrecoverable engine error. */
  error: Error;
  /** Periodic runtime performance sample for UI overlays/diagnostics. */
  performance: EnginePerformanceSample;
};

export type EnginePerformanceSample = {
  fps: number;
  paused: boolean;
  timestamp: number;
};

export type EngineEventName = keyof EngineEventMap;

/* ------------------------------------------------------------------ */
/*  Core SketchEngine interface                                        */
/* ------------------------------------------------------------------ */

/**
 * Abstraction every rendering back-end (p5.js, GSAP, Three.js …) must
 * implement so the studio route and recording pipeline can drive it
 * in a uniform way.
 */
export interface SketchEngine {
  /** Unique identifier of this engine (e.g. "p5", "gsap", "threejs"). */
  readonly engineId: string;

  /** `true` once `init()` has resolved and the engine is rendering. */
  readonly isReady: boolean;

  /* ---- lifecycle ------------------------------------------------- */

  /**
   * Mount the engine into `container`, load the template module and
   * apply `options`. Resolves when the first frame is visible.
   */
  init(
    container: HTMLElement,
    templatePath: string,
    options: SketchOption,
  ): Promise<void>;

  /** Tear down the engine and clean up DOM / globals. */
  destroy(): void;

  /**
   * Apply a partial options update without re-initialising.
   * Implementations should deep-merge and trigger a re-render.
   */
  updateOptions( partial: Partial<SketchOption> ): void;

  /* ---- playback -------------------------------------------------- */

  play(): void;
  pause(): void;
  stop(): void;

  /**
   * Render one frame without advancing time or resuming the loop.
   * Useful to reflect parameter changes while the loop is paused.
   */
  redraw(): void;

  /**
   * Jump to a specific frame index.
   * Mainly useful for timeline-based engines (GSAP, CSS keyframes …)
   * and for server-side frame capture.
   */
  seek( frame: number ): void;

  /* ---- capture --------------------------------------------------- */

  /**
   * Seek to `frame`, render it, and return a base-64 PNG data-URL of
   * the current canvas.  Used by the recording pipeline.
   */
  captureFrame( frame: number ): Promise<string>;

  /**
   * Calculate the total number of frames for the given options.
   * When `slideIndex` is provided, per-slide overrides are used.
   */
  getTotalFrames( options: SketchOption, slideIndex?: number ): number;

  /**
   * Frames-per-second the sketch is rendered at for the given options.
   * Used by the recorder to set encoder cadence + MediaRecorder timeslice.
   */
  getFrameRate( options: SketchOption, slideIndex?: number ): number;

  /**
   * Return the underlying `<canvas>` element (if any). For DOM/CSS engines
   * this is the mirror canvas used for capture, not the rendered surface.
   */
  getCanvas(): HTMLCanvasElement | null;

  /**
   * Engine-agnostic capture surface consumed by the client-side recorder.
   * Canvas engines wrap their live canvas; DOM engines return a source that
   * rasterises the rendered DOM into a mirror canvas on demand.
   */
  getCaptureSource(): CaptureSource;

  /**
   * Seek to `frame` and render it without producing a data-URL.
   * Cheaper than `captureFrame` for client-side async-loop
   * recording where the encoder reads pixels straight from the canvas.
   */
  seekAndDraw( frame: number ): Promise<void>;

  /**
   * Reset progression to frame 0 — both frame counter and any time
   * bridge driving the sketch. Used by the recorder so loops start
   * from the beginning every run, matching server-side capture.
   */
  resetToStart(): Promise<void>;

  /**
   * Declare what client-side recording modes/formats this engine
   * supports for the given sketch options. Consumed by the browser
   * recorder UI to pick a sensible default mode and gate formats.
   */
  getRecordingCapabilities(
    options: SketchOption,
    slideIndex?: number,
  ): RecorderCapabilities;

  /* ---- events ---------------------------------------------------- */

  on<E extends EngineEventName>(
    event: E,
    handler: ( payload: EngineEventMap[ E ] ) => void,
  ): void;

  off<E extends EngineEventName>(
    event: E,
    handler: ( payload: EngineEventMap[ E ] ) => void,
  ): void;
}

/* ------------------------------------------------------------------ */
/*  Engine registration                                                */
/* ------------------------------------------------------------------ */

/**
 * Each engine package exports an `EngineRegistration` which the central
 * registry uses to create engine instances and load templates on demand.
 */
export interface EngineRegistration {
  /** Must match the URL segment, e.g. "p5", "gsap", "threejs". */
  id: string;

  /** Human-readable label shown in the UI. */
  label: string;

  /** Factory – returns a fresh engine instance (not yet initialised). */
  createEngine(): SketchEngine;

  /**
   * Resolve a template by name (+ optional category prefix) and
   * return its file-system path relative to the sketches directory.
   * Throws if the template does not exist.
   */
  resolveTemplatePath( sketchName: string ): string;

  /**
   * Return metadata for all known templates so the home page can
   * display a catalogue.
   */
  listTemplates(): TemplateMetadata[];
}

export interface TemplateMetadata {
  name: string;
  engine: string;
  category: string | null;
  hasSketchForm: boolean;
  hasThumbnail: boolean;
}

/* ------------------------------------------------------------------ */
/*  Sketch metadata                                                    */
/* ------------------------------------------------------------------ */

/**
 * Shape of each entry in the unified `src/sketches/metadata.json`.
 * Shared across **all** engines — not p5-specific.
 */
export interface SketchMetadata {
  name: string;
  engine: string;
  category: string | null;
  hasSketchForm: boolean;
  hasThumbnail: boolean;
  hasPreview: boolean;
  // Visibility markers (driven by `.hidden-home` / `.hidden-template`
  // files inside a sketch dir — see scripts/watch-sketches.mjs).
  hiddenFromHome?: boolean;
  hiddenFromTemplates?: boolean;
  mtime: string;
  ctime: string;
}
