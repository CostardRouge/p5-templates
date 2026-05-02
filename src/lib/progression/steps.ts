import {
  RecordingProgressionSteps
} from "@/types/recording.types";
import {
  SketchOption, SlideOption
} from "@/types/sketch.types";

export const recordingSketchSteps: RecordingProgressionSteps = {
  recording: {
    steps: {
      "launching-browser": {
        percentage: 0,
      },
      "saving-frames": {
        percentage: 0,
      },
      "encoding-frames": {
        percentage: 0,
      },
    },
  },
  uploading: {
    percentage: 0,
  },
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
            "saving-frames": {
              percentage: 0
            },
            "encoding-frames": {
              percentage: 0
            },
          },
        },
      };
    },
    {
    }
  );

  return {
    recording: {
      steps: {
        "launching-browser": {
          percentage: 0
        },
        ...perSlideSteps,
      },
    },
    uploading: {
      steps: {
        archiving: {
          percentage: 0
        },
        s3: {
          percentage: 0
        },
      },
    },
  };
}

export function getRecordingSketchStepsByOptions( sketchOptions: SketchOption ) {
  const slides = sketchOptions.slides ?? null;

  if ( slides && Array.isArray( slides ) && slides.length > 0 ) {
    return createRecordingSketchStepsForSketchSlides( slides );
  }

  return {
    ...recordingSketchSteps,
  };
}
