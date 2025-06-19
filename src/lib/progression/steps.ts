import {
  RecordingSketchOptions,
  RecordingProgressionSteps,
  RecordingSketchSlideOption
} from "@/types/recording.types";

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

function createRecordingSketchStepsForSketchSlides( slides: RecordingSketchSlideOption[] ) {
  const recordingSketchStepsForSketchSlides = {
    ...recordingSketchSteps
  };

  recordingSketchStepsForSketchSlides.recording = {
    steps: slides.reduce(
      (
        accumulator,
        slide: RecordingSketchSlideOption,
        slideIndex
      ) => {
        const clonedSlideRecordingStep: any = JSON.parse( JSON.stringify( recordingSketchSteps.recording ) );

        if ( slide?.template ) {
          clonedSlideRecordingStep.description = slide?.template;
        }

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

export function getRecordingSketchStepsByOptions( sketchOptions: RecordingSketchOptions ) {
  const slides = sketchOptions.slides ?? null;

  if ( slides && Array.isArray( slides ) && slides.length > 0 ) {
    return createRecordingSketchStepsForSketchSlides( slides );
  }

  return {
    ...recordingSketchSteps
  };
}