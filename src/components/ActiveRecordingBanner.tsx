"use client";

import {
  useRef
} from "react";
import Link from "next/link";
import ProgressBar from "@/components/ProgressBar";
import {
  JobModel
} from "@/types/recording.types";
import {
  getRecordingSteps, getCurrentStepIndex
} from "@/utils/recordingSteps";

interface ActiveRecordingBannerProps {
  jobs: JobModel[];
  className?: string;
}

export default function ActiveRecordingBanner( {
  jobs,
  className = ""
}: ActiveRecordingBannerProps ) {
  const recordingStartTimesRef = useRef<Record<string, number>>( {} );

  // Track start times for active jobs
  jobs.forEach( ( job ) => {
    if ( job.status === "active" && !recordingStartTimesRef.current[ job.id ] ) {
      recordingStartTimesRef.current[ job.id ] = Date.now();
    }
  } );

  // Filter only active recordings
  const activeRecordings = jobs.filter( ( j ) => j.status === "active" );

  if ( activeRecordings.length === 0 ) {
    return null;
  }

  return (
    <div className={ `space-y-4 ${ className }` }>
      {activeRecordings.map( ( job ) => {
        const steps = getRecordingSteps( job );
        const currentStepIndex = getCurrentStepIndex( steps );

        return (
          <div key={ job.id } className="space-y-2">
            {/* Recording Header with Live Indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Pulsing red dot for live recording */}
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75"
                    style={ {
                      width: "12px",
                      height: "12px"
                    } }
                  />
                  <div
                    className="relative rounded-full bg-red-600"
                    style={ {
                      width: "12px",
                      height: "12px"
                    } }
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Recording: {job.sketch}
                  </h3>
                  <p className="text-xs text-foreground/60 font-mono">
                    #{job.id.slice(
                      0,
                      8
                    )}
                  </p>
                </div>
              </div>
              <Link
                href={ `/${ job.sketch }?id=${ job.id }` }
                className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
              >
                View Details →
              </Link>
            </div>

            {/* Detailed Progress Bar with Steps - Click to expand */}
            <ProgressBar
              variant="detailed"
              steps={ steps }
              currentStepIndex={ currentStepIndex }
              overallPercentage={ job.progress || 0 }
              showElapsedTime
              startTime={ recordingStartTimesRef.current[ job.id ] || Date.now() }
            />
          </div>
        );
      } )}
    </div>
  );
}
