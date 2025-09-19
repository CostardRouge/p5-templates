import {
  RecordingProgressionSteps
} from "@/types/recording.types";
import {
  SketchOption,
  SlideOption
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
      "downloading-frames-archive": {
        percentage: 0,
      },
      "extracting-frames-archive": {
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
  const recordingSketchStepsForSketchSlides = {
    ...recordingSketchSteps
  };

  recordingSketchStepsForSketchSlides.recording = {
    steps: slides.reduce(
      (
        accumulator,
        slide: SlideOption,
        slideIndex
      ) => {
        const clonedSlideRecordingStep: any = JSON.parse( JSON.stringify( recordingSketchSteps.recording ) );

        return {
          ...accumulator,
          [ `slide-${ slideIndex }` ]: {
            ...clonedSlideRecordingStep
          }
        };
      },
      {
      }
    )
  };

  recordingSketchStepsForSketchSlides.uploading = {
    steps: {
      archiving: {
        percentage: 0,
      },
      s3: {
        percentage: 0,
      }
    }
  };

  return recordingSketchStepsForSketchSlides;
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