"use client";

import {
  JobModel
} from "@/types/recording.types";

interface SimpleProgressBarProps {
  progress: number;
  status?: JobModel["status"];
}

export default function SimpleProgressBar( {
  progress,
  status
}: SimpleProgressBarProps ) {
  // Show indeterminate state for active/queued jobs with 0 progress
  const isIndeterminate =
    ( status === "active" || status === "queued" ) && progress === 0;

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/50">
          {isIndeterminate ? "Starting..." : "Progress"}
        </span>
        <span className="text-foreground font-semibold tabular-nums">
          {isIndeterminate ? "—" : `${ progress }%`}
        </span>
      </div>

      <div className="w-full bg-hover/50 rounded-full h-2 overflow-hidden">
        {isIndeterminate ? (
          <div className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 animate-pulse w-full opacity-60" />
        ) : (
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 ease-out rounded-full"
            style={{
              width: `${ progress }%`
            }}
          />
        )}
      </div>
    </div>
  );
}
