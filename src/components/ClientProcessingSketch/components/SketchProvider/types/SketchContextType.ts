import type {
  SketchOption
} from "@/types/sketch.types";
import {
  JobModel
} from "@/types/recording.types";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
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
  engine: SketchEngine | null;
  /** Whether the engine draw-loop is currently running. */
  looping: boolean;
};

export type SketchAction =
  | {
    type: "SET_OPTIONS";
    payload: SketchOption
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
