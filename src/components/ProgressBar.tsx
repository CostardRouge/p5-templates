"use client";

import {
  useState, useEffect
} from "react";
import {
  Check, Loader2, ChevronDown, ChevronUp
} from "lucide-react";

export interface ProgressStep {
  id: string;
  name: string;
  status: "pending" | "active" | "completed" | "error";
  percentage?: number;
}

interface ProgressBarProps {
  steps?: ProgressStep[];
  currentStepIndex?: number;
  overallPercentage?: number;
  showElapsedTime?: boolean;
  startTime?: number;
  variant?: "simple" | "detailed";
  className?: string;
}

export default function ProgressBar( {
  steps = [],
  currentStepIndex = 0,
  overallPercentage = 0,
  showElapsedTime = false,
  startTime,
  variant = "simple",
  className = ""
}: ProgressBarProps ) {
  const [
    elapsedTime,
    setElapsedTime
  ] = useState( 0 );
  const [
    isExpanded,
    setIsExpanded
  ] = useState( false );

  useEffect(
    () => {
      if ( !showElapsedTime || !startTime ) {
        return;
      }

      const interval = setInterval(
        () => {
          setElapsedTime( Math.floor( ( Date.now() - startTime ) / 1000 ) );
        },
        1000
      );

      return () => clearInterval( interval );
    },
    [
      showElapsedTime,
      startTime
    ]
  );

  const formatTime = ( seconds: number ) => {
    const mins = Math.floor( seconds / 60 );
    const secs = seconds % 60;

    return `${ mins }:${ secs.toString().padStart(
      2,
      "0"
    ) }`;
  };

  const currentStep = steps[ currentStepIndex ];
  const completedSteps = steps.filter( ( s ) => s.status === "completed" ).length;

  if ( variant === "simple" ) {
    return (
      <div className={ `w-full ${ className }` }>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            {currentStep?.name || "Processing..."}
          </span>
          <div className="flex items-center gap-3">
            {showElapsedTime && (
              <span className="text-sm text-label font-mono">
                {formatTime( elapsedTime )}
              </span>
            )}
            <span className="text-sm font-semibold text-blue-500">
              {overallPercentage}%
            </span>
          </div>
        </div>
        <div className="h-2 bg-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
            style={ {
              width: `${ overallPercentage }%`
            } }
          />
        </div>
      </div>
    );
  }

  return (
    <div className={ `w-full ${ className }` }>
      {/* Compact Header */}
      <button
        onClick={ () => setIsExpanded( !isExpanded ) }
        className="w-full bg-background rounded-lg border border-border p-4 hover:border-blue-500/50 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {currentStep?.status === "active" && (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            )}
            {currentStep?.status === "completed" && (
              <Check className="w-4 h-4 text-green-500" />
            )}
            <span className="text-sm font-semibold text-foreground">
              {currentStep?.name || "Processing..."}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {showElapsedTime && (
              <span className="text-sm text-label font-mono">
                {formatTime( elapsedTime )}
              </span>
            )}
            <span className="text-sm font-bold text-blue-500">
              {overallPercentage}%
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-label" />
            ) : (
              <ChevronDown className="w-4 h-4 text-label" />
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 transition-all duration-500 ease-out relative"
            style={ {
              width: `${ overallPercentage }%`
            } }
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>

        {/* Step Counter */}
        <div className="mt-2 text-xs text-label">
          Step {currentStepIndex + 1} of {steps.length} • {completedSteps}{" "}
          completed
        </div>
      </button>

      {/* Expanded Steps List */}
      {isExpanded && (
        <div className="mt-2 bg-background rounded-lg border border-border p-4 space-y-3">
          {steps.map( (
            step, index
          ) => (
            <div
              key={ step.id }
              className={ `flex items-center gap-3 p-3 rounded-lg transition-all ${
                step.status === "active"
                  ? "bg-blue-500/10 border border-blue-500/30"
                  : step.status === "completed"
                    ? "bg-green-500/10"
                    : "bg-hover/50"
              }` }
            >
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {step.status === "completed" && (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                {step.status === "active" && (
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
                {step.status === "pending" && (
                  <div className="w-6 h-6 rounded-full bg-hover flex items-center justify-center">
                    <span className="text-xs text-label font-medium">
                      {index + 1}
                    </span>
                  </div>
                )}
                {step.status === "error" && (
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white text-xs">✕</span>
                  </div>
                )}
              </div>

              {/* Step Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={ `text-sm font-medium truncate ${
                      step.status === "active"
                        ? "text-blue-500"
                        : step.status === "completed"
                          ? "text-green-500"
                          : step.status === "error"
                            ? "text-red-500"
                            : "text-label"
                    }` }
                  >
                    {step.name}
                  </span>
                  {step.percentage !== undefined && (
                    <span
                      className={ `text-xs font-semibold ${
                        step.status === "active"
                          ? "text-blue-500"
                          : step.status === "completed"
                            ? "text-green-500"
                            : "text-label"
                      }` }
                    >
                      {step.percentage}%
                    </span>
                  )}
                </div>

                {/* Step Progress Bar */}
                {step.status === "active" && step.percentage !== undefined && (
                  <div className="mt-2 h-1 bg-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={ {
                        width: `${ step.percentage }%`
                      } }
                    />
                  </div>
                )}
              </div>
            </div>
          ) )}
        </div>
      )}
    </div>
  );
}
