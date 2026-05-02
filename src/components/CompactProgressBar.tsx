"use client";

import {
  useState, useEffect
} from "react";
import {
  Check, Loader2, ChevronUp, ChevronDown
} from "lucide-react";
import {
  Popover, PopoverButton, PopoverPanel
} from "@headlessui/react";
import type {
  JobModel, RecordingProgressionSteps
} from "@/types/recording.types";
import type {
  SlideOption
} from "@/types/sketch.types";

export interface ProgressStep {
  id: string;
  name: string;
  status: "pending" | "active" | "completed" | "error";
  percentage?: number;
}

const STEP_LABELS: Record<string, string> = {
  "launching-browser": "Launching browser",
  "saving-frames": "Capturing frames",
  "encoding-frames": "Encoding video",
  archiving: "Archiving",
  s3: "Uploading to S3",
};

function getCurrentStepLabel(
  recordingSteps: RecordingProgressionSteps,
  currentSlideIndex: number | undefined,
  slideOptions: SlideOption[] | undefined
): string {
  const rec = ( recordingSteps.recording as any );
  const uploading = ( recordingSteps.uploading as any );
  const launchingBrowser = rec?.steps?.[ "launching-browser" ];

  if ( launchingBrowser && launchingBrowser.percentage < 100 ) {
    return "Launching browser";
  }

  if ( currentSlideIndex !== undefined ) {
    const slideSteps = rec?.steps?.[ `slide-${ currentSlideIndex }` ]?.steps;

    if ( slideSteps ) {
      const slideName = slideOptions?.[ currentSlideIndex ]?.name ?? `Slide ${ currentSlideIndex + 1 }`;

      if ( ( slideSteps[ "saving-frames" ]?.percentage ?? 100 ) < 100 ) {
        return `${ slideName } — Capturing frames`;
      }

      if ( ( slideSteps[ "encoding-frames" ]?.percentage ?? 100 ) < 100 ) {
        return `${ slideName } — Encoding video`;
      }
    }
  }

  if ( uploading?.steps ) {
    if ( ( uploading.steps.archiving?.percentage ?? 100 ) < 100 ) return "Archiving";
    if ( ( uploading.steps.s3?.percentage ?? 100 ) < 100 ) return "Uploading to S3";
  } else if ( typeof uploading?.percentage === "number" && uploading.percentage < 100 ) {
    return "Uploading";
  }

  return "Processing...";
}

interface CompactProgressBarProps {
  job: JobModel;
  steps?: ProgressStep[];
  recordingSteps?: RecordingProgressionSteps;
  currentSlideIndex?: number;
  slideOptions?: SlideOption[];
  startTime?: number;
  className?: string;
}

export default function CompactProgressBar( {
  job,
  steps = [
  ],
  recordingSteps,
  currentSlideIndex,
  slideOptions,
  startTime,
  className = "",
}: CompactProgressBarProps ) {
  const [
    elapsedTime,
    setElapsedTime
  ] = useState( 0 );
  const [
    expandedSlides,
    setExpandedSlides
  ] = useState<Set<number>>( new Set() );

  useEffect(
    () => {
    // Use recordingStartAt from DB if available, otherwise fall back to client-side startTime
      const recordingStart = job.recordingStartAt
        ? new Date( job.recordingStartAt ).getTime()
        : startTime;

      if ( !recordingStart || job.status !== "active" ) return;

      // Calculate initial elapsed time
      setElapsedTime( Math.floor( ( Date.now() - recordingStart ) / 1000 ) );

      const interval = setInterval(
        () => {
          setElapsedTime( Math.floor( ( Date.now() - recordingStart ) / 1000 ) );
        },
        1000
      );

      return () => clearInterval( interval );
    },
    [
      startTime,
      job.status,
      job.recordingStartAt
    ]
  );

  // Auto-expand the active slide, auto-collapse the previous one
  useEffect(
    () => {
      if ( currentSlideIndex !== undefined ) {
        setExpandedSlides( ( prev ) => {
          const next = new Set( prev );

          next.add( currentSlideIndex );

          if ( currentSlideIndex > 0 ) {
            next.delete( currentSlideIndex - 1 );
          }

          return next;
        } );
      }
    },
    [
      currentSlideIndex
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

  const currentStep = steps.find( ( s ) => s.status === "active" );
  const completedSteps = steps.filter( ( s ) => s.status === "completed" ).length;
  const isActive = job.status === "active" || job.status === "queued";
  const progress = job.progress || 0;

  // Detect multi-slide step structure
  const recSteps = ( recordingSteps?.recording as any )?.steps;
  const isMultiSlide = !!recSteps && Object.keys( recSteps ).some( ( k ) => k.startsWith( "slide-" ) );
  const slideKeys = isMultiSlide
    ? Object.keys( recSteps ).filter( ( k ) => k.startsWith( "slide-" ) )
      .sort()
    : [
    ];
  const hasPopover = isMultiSlide || steps.length > 0;

  const compactStepLabel = recordingSteps
    ? getCurrentStepLabel(
      recordingSteps,
      currentSlideIndex,
      slideOptions
    )
    : ( currentStep?.name ?? "Processing..." );

  function slideAggregate( idx: number ) {
    const ss = recSteps?.[ `slide-${ idx }` ]?.steps;

    if ( !ss ) return 0;
    const saving = ss[ "saving-frames" ]?.percentage ?? 0;
    const encoding = ss[ "encoding-frames" ]?.percentage ?? 0;

    return Math.round( ( saving + encoding ) / 2 );
  }

  function slideStatus( idx: number ): "pending" | "active" | "completed" {
    if ( currentSlideIndex === undefined ) return "pending";
    if ( idx < currentSlideIndex ) return "completed";
    if ( idx === currentSlideIndex ) return "active";

    return "pending";
  }

  const completedSlideCount = currentSlideIndex ?? 0;

  // For completed recordings, show simple green progress bar
  if ( job.status === "completed" ) {
    return (
      <div className={`w-full ${ className }`}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-foreground/50">Completed</span>
          <span className="text-green-600 dark:text-green-400 font-semibold">
            100%
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-500 to-green-600 w-full" />
        </div>
      </div>
    );
  }

  // For draft/failed/cancelled recordings, show simple gray progress bar
  if ( !isActive ) {
    return (
      <div className={`w-full ${ className }`}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-foreground/50 capitalize">{job.status}</span>
          <span className="text-foreground/60 font-semibold">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-400 dark:bg-gray-500 transition-all duration-300"
            style={{
              width: `${ progress }%`,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <Popover className={`relative w-full ${ className }`}>
      {( {
        open
      } ) => (
        <>
          <PopoverButton
            className="w-full text-left hover:opacity-80 transition-opacity focus:outline-none"
            onClick={( e: React.MouseEvent ) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-xs mb-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {( currentStep || recordingSteps ) && (
                  <Loader2 className="w-3 h-3 text-blue-500 animate-spin flex-shrink-0" />
                )}
                <span className="text-foreground/70 truncate">
                  {compactStepLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isMultiSlide && currentSlideIndex !== undefined && slideOptions && (
                  <span className="text-[10px] font-mono text-foreground/40">
                    {currentSlideIndex + 1}/{slideOptions.length}
                  </span>
                )}
                {startTime && (
                  <span className="text-foreground/50 font-mono text-[10px]">
                    {formatTime( elapsedTime )}
                  </span>
                )}
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  {progress}%
                </span>
                {hasPopover && (
                  <ChevronUp
                    className={`w-3 h-3 text-foreground/40 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                )}
              </div>
            </div>

            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out relative"
                style={{
                  width: `${ progress }%`,
                }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            {isMultiSlide ? (
              <div className="text-[10px] text-foreground/40 mt-1 truncate">
                {completedSlideCount > 0
                  ? `${ completedSlideCount } of ${ slideKeys.length } slides done`
                  : `${ slideKeys.length } slides to record`}
              </div>
            ) : steps.length > 0 && (
              <div className="text-[10px] text-foreground/40 mt-1 truncate">
                Step {completedSteps + 1} of {steps.length} • {completedSteps}{" "}
                completed
              </div>
            )}
          </PopoverButton>

          {hasPopover && (
            <PopoverPanel
              anchor="bottom start"
              className="z-50 w-80 max-w-[calc(100vw-1rem)] bg-background rounded-lg border border-border shadow-xl p-3 space-y-2 [--anchor-gap:0.5rem] [--anchor-padding:0.5rem]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Recording Progress
                  </div>
                  {job.id && (
                    <div className="text-[10px] text-foreground/50 font-mono">
                      #{job.id.slice(
                        0,
                        8
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {progress}%
                  </div>
                  {startTime && (
                    <div className="text-[10px] text-foreground/50 font-mono">
                      {formatTime( elapsedTime )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {isMultiSlide ? (
                  <>
                    {/* Shared: Launching browser */}
                    {recSteps[ "launching-browser" ] && (
                      <SharedStepRow
                        label="Launching browser"
                        percentage={recSteps[ "launching-browser" ].percentage ?? 0}
                      />
                    )}

                    {/* Per-slide rows */}
                    {slideKeys.map( (
                      key, idx
                    ) => {
                      const status = slideStatus( idx );
                      const aggregate = slideAggregate( idx );
                      const ss = recSteps[ key ]?.steps ?? {
                      };
                      const isExpanded = expandedSlides.has( idx );
                      const slideName = slideOptions?.[ idx ]?.name ?? `Slide ${ idx + 1 }`;

                      return (
                        <div key={key}>
                          <button
                            type="button"
                            className={`w-full flex items-center gap-2 p-1.5 rounded-lg transition-all text-left ${
                              status === "active"
                                ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                : status === "completed"
                                  ? "bg-green-50 dark:bg-green-900/10"
                                  : "bg-gray-50 dark:bg-gray-900/30"
                            }`}
                            onClick={() =>
                              setExpandedSlides( ( prev ) => {
                                const next = new Set( prev );

                                if ( next.has( idx ) ) next.delete( idx );
                                else next.add( idx );

                                return next;
                              } )}
                          >
                            <div className="flex-shrink-0">
                              {status === "completed" && (
                                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                              {status === "active" && (
                                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                                </div>
                              )}
                              {status === "pending" && (
                                <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                  <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">
                                    {idx + 1}
                                  </span>
                                </div>
                              )}
                            </div>

                            <span
                              className={`flex-1 text-xs font-medium truncate ${
                                status === "active"
                                  ? "text-blue-700 dark:text-blue-300"
                                  : status === "completed"
                                    ? "text-green-700 dark:text-green-300"
                                    : "text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {slideName}
                            </span>

                            {status !== "pending" && (
                              <span
                                className={`text-[10px] font-semibold flex-shrink-0 ${
                                  status === "completed"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-blue-600 dark:text-blue-400"
                                }`}
                              >
                                {status === "completed" ? "100" : aggregate}%
                              </span>
                            )}

                            <ChevronDown
                              className={`w-3 h-3 text-foreground/40 flex-shrink-0 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {/* Expanded sub-steps */}
                          {isExpanded && (
                            <div className="ml-7 mt-1 space-y-1">
                              {Object.entries( ss ).map( ( [
                                subKey,
                                subVal
                              ] ) => (
                                <SubStepRow
                                  key={subKey}
                                  label={STEP_LABELS[ subKey ] ?? subKey}
                                  percentage={( subVal as any )?.percentage ?? 0}
                                  parentStatus={status}
                                />
                              ) )}
                            </div>
                          )}
                        </div>
                      );
                    } )}

                    {/* Shared: Uploading */}
                    {( recordingSteps?.uploading as any )?.steps && (
                      <div className="pt-1 border-t border-border/50 space-y-1.5">
                        {Object.entries( ( recordingSteps!.uploading as any ).steps ).map( ( [
                          key,
                          val
                        ] ) => (
                          <SharedStepRow
                            key={key}
                            label={STEP_LABELS[ key ] ?? key}
                            percentage={( val as any )?.percentage ?? 0}
                          />
                        ) )}
                      </div>
                    )}
                  </>
                ) : (
                  /* Existing flat single-slide step list */
                  <>
                    {steps.map( (
                      step, index
                    ) => (
                      <div
                        key={step.id}
                        className={`flex items-start gap-2 p-2 rounded-lg transition-all ${
                          step.status === "active"
                            ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                            : step.status === "completed"
                              ? "bg-green-50 dark:bg-green-900/10"
                              : "bg-gray-50 dark:bg-gray-900/30"
                        }`}
                      >
                        {/* Status Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {step.status === "completed" && (
                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {step.status === "active" && (
                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                              <Loader2 className="w-3 h-3 text-white animate-spin" />
                            </div>
                          )}
                          {step.status === "pending" && (
                            <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">
                                {index + 1}
                              </span>
                            </div>
                          )}
                          {step.status === "error" && (
                            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                              <span className="text-white text-[10px]">✕</span>
                            </div>
                          )}
                        </div>

                        {/* Step Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span
                              className={`text-xs font-medium truncate ${
                                step.status === "active"
                                  ? "text-blue-700 dark:text-blue-300"
                                  : step.status === "completed"
                                    ? "text-green-700 dark:text-green-300"
                                    : step.status === "error"
                                      ? "text-red-700 dark:text-red-300"
                                      : "text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {step.name}
                            </span>
                            {step.percentage !== undefined &&
                          step.status === "active" && (
                              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                {step.percentage.toPrecision( 3 )}%
                              </span>
                            )}
                          </div>

                          {/* Step Progress Bar */}
                          {step.status === "active" &&
                        step.percentage !== undefined && (
                            <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{
                                  width: `${ step.percentage }%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ) )}
                  </>
                )}
              </div>
            </PopoverPanel>
          )}
        </>
      )}
    </Popover>
  );
}

function SharedStepRow( {
  label,
  percentage,
}: {
  label: string;
  percentage: number;
} ) {
  const isDone = percentage >= 100;

  return (
    <div
      className={`flex items-center gap-2 p-1.5 rounded-lg ${
        isDone
          ? "bg-green-50 dark:bg-green-900/10"
          : "bg-gray-50 dark:bg-gray-900/30"
      }`}
    >
      <div className="w-5 h-5 flex-shrink-0">
        {isDone ? (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600" />
        )}
      </div>
      <span
        className={`text-xs flex-1 ${
          isDone
            ? "text-green-700 dark:text-green-300"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {label}
      </span>
      {isDone && (
        <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">
          100%
        </span>
      )}
    </div>
  );
}

function SubStepRow( {
  label,
  percentage,
  parentStatus,
}: {
  label: string;
  percentage: number;
  parentStatus: "pending" | "active" | "completed";
} ) {
  const isActive = parentStatus === "active" && percentage > 0 && percentage < 100;
  const isDone = percentage >= 100 || parentStatus === "completed";

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          isDone
            ? "bg-green-500"
            : isActive
              ? "bg-blue-500"
              : "bg-gray-300 dark:bg-gray-600"
        }`}
      />
      <span
        className={`text-[11px] flex-1 ${
          isDone
            ? "text-green-700 dark:text-green-300"
            : isActive
              ? "text-blue-700 dark:text-blue-300"
              : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {label}
      </span>
      {isActive && (
        <span className="text-[10px] text-blue-600 dark:text-blue-400">
          {Math.round( percentage )}%
        </span>
      )}
    </div>
  );
}
