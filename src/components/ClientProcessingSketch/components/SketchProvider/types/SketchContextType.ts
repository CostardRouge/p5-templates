import type {
  SketchOption
} from "@/types/sketch.types";
import {
  JobModel
} from "@/types/recording.types";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import type {
  SketchEngine
} from "@/engines/types";

export type SketchState = {
  name: string;
  engineId: string;
  category?: string | null;
  capturing: boolean;
  options: SketchOption;
  persistedJob?: JobModel;
  backendRecording: boolean;
  activeSlideIndex?: number;
  sketchFormValues?: Record<string, any>;
  sketchFormConfiguration?: Record<string, FieldConfig>;
  sketchLoaded: boolean;
  /**
   * Dotted form paths covered by the latest SET_OPTIONS, when known. Lets
   * the runtime sync push only the changed subtrees instead of walking the
   * whole options tree on every form tick; undefined means "unknown — sync
   * the full tree".
   */
  optionsChangedPaths?: string[];
  engine: SketchEngine | null;
  /** Whether the engine draw-loop is currently running. */
  looping: boolean;
  /**
   * True while a browser-side (frontend) recording is in progress. Used to
   * lock playback controls (Play/Pause, progression scrub) so the user
   * can't corrupt the in-flight capture or desync engine vs. looping state.
   */
  browserRecording: boolean;
};

export type SketchAction =
  | {
    type: "SET_OPTIONS";
    payload: SketchOption;
    /** See SketchState.optionsChangedPaths. */
    changedPaths?: string[]
  }
  | {
    type: "SET_LOADED";
    payload: boolean
  }
  | {
    type: "SET_ACTIVE_SLIDE";
    payload: number | undefined
  }
  | {
    type: "SET_ENGINE";
    payload: SketchEngine | null
  }
  | {
    type: "SET_LOOPING";
    payload: boolean
  }
  | {
    type: "SET_CAPTURING";
    payload: boolean
  }
  | {
    type: "SET_BROWSER_RECORDING";
    payload: boolean
  };

/** Props accepted by SketchContextProvider (initial values from RSC). */
export type SketchContextProviderProps = {
  name: string;
  engineId: string;
  category?: string | null;
  capturing: boolean;
  options: SketchOption;
  persistedJob?: JobModel;
  backendRecording: boolean;
  activeSlideIndex?: number;
  sketchFormValues?: Record<string, any>;
  sketchFormConfiguration?: Record<string, FieldConfig>;
};
