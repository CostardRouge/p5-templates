import type { SketchOption } from "@/types/sketch.types";

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
   */
  getTotalFrames( options: SketchOption ): number;

  /**
   * Return the underlying `<canvas>` element (if any).
   */
  getCanvas(): HTMLCanvasElement | null;

  /* ---- events ---------------------------------------------------- */

  on<E extends EngineEventName>(
    event: E,
    handler: ( payload: EngineEventMap[E] ) => void,
  ): void;

  off<E extends EngineEventName>(
    event: E,
    handler: ( payload: EngineEventMap[E] ) => void,
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
  mtime: string;
  ctime: string;
}
