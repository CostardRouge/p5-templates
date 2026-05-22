import {
  RecordingProgressionSteps
} from "@/types/recording.types";
import {
  SketchOption, SlideOption
} from "@/types/sketch.types";
import {
  RECORDING_STEPS
} from "./stepConfig";

export const recordingSketchSteps: RecordingProgressionSteps = {
  recording: {
    steps: {
      [ RECORDING_STEPS.LAUNCHING_BROWSER.key ]: {
        percentage: 0
      },
      [ RECORDING_STEPS.ENCODING.key ]: {
        percentage: 0
      }
    }
  },
  uploading: {
    percentage: 0
  }
};

function createRecordingSketchStepsForSketchSlides( slides: SlideOption[] ) {
  const perSlideSteps = slides.reduce(
    (
      acc: Record<string, any>, _slide: SlideOption, slideIndex: number
    ) => {
      return {
        ...acc,
        [ `slide-${ slideIndex }` ]: {
          steps: {
            [ RECORDING_STEPS.ENCODING.key ]: {
              percentage: 0
            }
          }
        }
      };
    },
    {}
  );

  return {
    recording: {
      steps: {
        [ RECORDING_STEPS.LAUNCHING_BROWSER.key ]: {
          percentage: 0
        },
        ...perSlideSteps
      }
    },
    uploading: {
      steps: {
        archiving: {
          percentage: 0
        },
        s3: {
          percentage: 0
        }
      }
    }
  };
}

export function getRecordingSketchStepsByOptions( sketchOptions: SketchOption ) {
  const slides = sketchOptions.slides ?? null;

  if ( slides && Array.isArray( slides ) && slides.length > 0 ) {
    return createRecordingSketchStepsForSketchSlides( slides );
  }

  return {
    ...recordingSketchSteps
  };
}
