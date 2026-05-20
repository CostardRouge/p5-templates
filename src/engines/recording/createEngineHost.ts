import type {
  SketchEngine
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";
import type {
  RecorderHost
} from "./types";

/**
 * Wrap a `SketchEngine` in the narrow `RecorderHost` contract so the
 * recorder strategies don't depend on the full engine surface.
 *
 * `totalFrames` + `frameRate` are resolved eagerly so the host stays
 * stable for the duration of a recording (options changes mid-record
 * would invalidate encoder dimensions anyway).
 */
export function createEngineHost(
  engine: SketchEngine,
  options: SketchOption,
  slideIndex?: number
): RecorderHost {
  const totalFrames = engine.getTotalFrames(
    options,
    slideIndex
  );
  const frameRate = engine.getFrameRate(
    options,
    slideIndex
  );

  return {
    getCaptureSource: () => engine.getCaptureSource(),
    getCanvas: () => engine.getCanvas(),
    seekAndDraw: ( frame ) => engine.seekAndDraw( frame ),
    resetToStart: () => engine.resetToStart(),
    pause: () => engine.pause(),
    resume: () => engine.play(),
    totalFrames,
    frameRate
  };
}
