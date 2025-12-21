"use client";

import {
  useEffect
} from "react";
import ProgressBar from "@/components/ProgressBar";
import {
  useProgress
} from "@/hooks/useProgress";

// Example 1: Simple Progress Bar
export function SimpleProgressExample() {
  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">Simple Progress</h3>
      <ProgressBar
        variant="simple"
        overallPercentage={65}
        showElapsedTime
        startTime={Date.now() - 45000}
        steps={[
          {
            id: "1",
            name: "Processing video...",
            status: "active",
          },
        ]}
      />
    </div>
  );
}

// Example 2: Recording Progress with Steps
export function RecordingProgressExample() {
  const progress = useProgress( [
    {
      id: "launch",
      name: "Launching browser",
    },
    {
      id: "capture",
      name: "Capturing frames",
    },
    {
      id: "save",
      name: "Saving frames",
    },
    {
      id: "encode",
      name: "Encoding video",
    },
    {
      id: "finalize",
      name: "Finalizing",
    },
  ] );

  useEffect(
    () => {
    // Simulate recording progress
      const simulate = async() => {
        progress.startStep( "launch" );
        await new Promise( ( r ) => setTimeout(
          r,
          1000
        ) );
        progress.completeStep( "launch" );

        progress.startStep( "capture" );
        for ( let i = 0; i <= 100; i += 10 ) {
          progress.updateStepProgress(
            "capture",
            i
          );
          await new Promise( ( r ) => setTimeout(
            r,
            300
          ) );
        }
        progress.completeStep( "capture" );

        progress.startStep( "save" );
        for ( let i = 0; i <= 100; i += 20 ) {
          progress.updateStepProgress(
            "save",
            i
          );
          await new Promise( ( r ) => setTimeout(
            r,
            200
          ) );
        }
        progress.completeStep( "save" );

        progress.startStep( "encode" );
        for ( let i = 0; i <= 100; i += 5 ) {
          progress.updateStepProgress(
            "encode",
            i
          );
          await new Promise( ( r ) => setTimeout(
            r,
            400
          ) );
        }
        progress.completeStep( "encode" );

        progress.startStep( "finalize" );
        await new Promise( ( r ) => setTimeout(
          r,
          500
        ) );
        progress.completeStep( "finalize" );
      };

      simulate();
    },
    [
      progress
    ]
  );

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Recording Progress</h3>
      <ProgressBar
        variant="detailed"
        steps={progress.steps}
        currentStepIndex={progress.currentStepIndex}
        overallPercentage={progress.overallPercentage}
        showElapsedTime
        startTime={progress.startTime}
      />
    </div>
  );
}

// Example 3: Sketch Generation Progress
export function SketchProgressExample() {
  const progress = useProgress( [
    {
      id: "init",
      name: "Initializing sketch",
    },
    {
      id: "render",
      name: "Rendering slides",
    },
    {
      id: "thumbnail",
      name: "Generating thumbnails",
    },
    {
      id: "save",
      name: "Saving sketch",
    },
  ] );

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Sketch Generation</h3>
      <ProgressBar
        variant="detailed"
        steps={progress.steps}
        currentStepIndex={progress.currentStepIndex}
        overallPercentage={progress.overallPercentage}
        showElapsedTime
        startTime={progress.startTime}
      />
    </div>
  );
}
