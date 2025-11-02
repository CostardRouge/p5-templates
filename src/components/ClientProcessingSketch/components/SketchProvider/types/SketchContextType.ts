import type {
  SketchOption
} from "@/types/sketch.types";
import {
  JobModel
} from "@/types/recording.types";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export type SketchContextType = {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  activeSlideIndex?: number,
  sketchFormValues?: Record<string, any>
  sketchFormConfiguration?: Record<string, FieldConfig>
}