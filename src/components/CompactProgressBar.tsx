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
import {
  resolveProgressionUIState,
  type FlatStepUI,
  type SlideUI,
  type StepUIStatus
} from "@/lib/progression/stepConfig";

export interface ProgressStep {
  id: string;
  name: string;
  status: "pending" | "active" | "completed" | "error";
  percentage?: number;
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
  steps = [],
  recordingSteps,
  currentSlideIndex,
  slideOptions,
  startTime,
  className = ""
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
      const recordingStart = job.recordingStartAt
        ? new Date( job.recordingStartAt ).getTime()
        : startTime;

      if ( !recordingStart || job.status !== "active" ) {
        return;
      }

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

  const isActive = job.status === "active" || job.status === "queued";
  const progress = job.progress || 0;

  // ── Resolve UI state from the raw progression tree ──────────────────────
  const uiState = recordingSteps
    ? resolveProgressionUIState(
      recordingSteps,
      currentSlideIndex,
      slideOptions
    )
    : null;

  const compactStepLabel = uiState
    ? uiState.currentLabel
    : ( steps.find( ( s ) => s.status === "active" )?.name ?? "Processing..." );

  const isMultiSlide = uiState?.isMultiSlide ?? false;
  const hasPopover = isMultiSlide || steps.length > 0;
  const completedSteps = steps.filter( ( s ) => s.status === "completed" ).length;
  const completedSlideCount = currentSlideIndex ?? 0;

  // ── Completed ────────────────────────────────────────────────────────────
  if ( job.status === "completed" ) {
    return (
      <div className={`w-full ${ className }`}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-foreground/50">Completed</span>
          <span className="text-green-600 dark:text-green-400 font-semibold">100%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-500 to-green-600 w-full" />
        </div>
      </div>
    );
  }

  // ── Inactive (draft / failed / cancelled) ────────────────────────────────
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
              width: `${ progress }%`
            }}
          />
        </div>
      </div>
    );
  }

  // ── Active ───────────────────────────────────────────────────────────────
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
                {( steps.find( ( s ) => s.status === "active" ) || recordingSteps ) && (
                  <Loader2 className="w-3 h-3 text-blue-500 animate-spin flex-shrink-0" />
                )}
                <span className="text-foreground/70 truncate">{compactStepLabel}</span>
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
                    className={`w-3 h-3 text-foreground/40 transition-transform ${ open ? "rotate-180" : "" }`}
                  />
                )}
              </div>
            </div>

            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out relative"
                style={{
                  width: `${ progress }%`
                }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            {isMultiSlide ? (
              <div className="text-[10px] text-foreground/40 mt-1 truncate">
                {completedSlideCount > 0
                  ? `${ completedSlideCount } of ${ uiState!.slides.length } slides done`
                  : `${ uiState!.slides.length } slides to record`}
              </div>
            ) : steps.length > 0 && (
              <div className="text-[10px] text-foreground/40 mt-1 truncate">
                Step {completedSteps + 1} of {steps.length} • {completedSteps} completed
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
                  <div className="text-xs font-semibold text-foreground">Recording Progress</div>
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
                {uiState && isMultiSlide ? (
                  <MultiSlideStepList
                    uiState={uiState}
                    expandedSlides={expandedSlides}
                    onToggleSlide={( idx ) =>
                      setExpandedSlides( ( prev ) => {
                        const next = new Set( prev );

                        if ( next.has( idx ) ) {
                          next.delete( idx );
                        } else {
                          next.add( idx );
                        }
                        return next;
                      } )
                    }
                  />
                ) : (
                  <FlatStepList steps={steps} />
                )}
              </div>
            </PopoverPanel>
          )}
        </>
      )}
    </Popover>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MultiSlideStepList( {
  uiState,
  expandedSlides,
  onToggleSlide
}: {
  uiState: ReturnType<typeof resolveProgressionUIState>;
  expandedSlides: Set<number>;
  onToggleSlide: ( idx: number ) => void;
} ) {
  return (
    <>
      {/* Shared leading steps (e.g. launching browser) */}
      {uiState.sharedLeadingSteps.map( ( step ) => (
        <SharedStepRow key={step.key} step={step} />
      ) )}

      {/* Per-slide rows */}
      {uiState.slides.map( ( slide ) => (
        <SlideRow
          key={slide.index}
          slide={slide}
          isExpanded={expandedSlides.has( slide.index )}
          onToggle={() => onToggleSlide( slide.index )}
        />
      ) )}

      {/* Shared trailing steps (e.g. uploading) */}
      {uiState.sharedTrailingSteps.length > 0 && (
        <div className="pt-1 border-t border-border/50 space-y-1.5">
          {uiState.sharedTrailingSteps.map( ( step ) => (
            <SharedStepRow key={step.key} step={step} />
          ) )}
        </div>
      )}
    </>
  );
}

function SlideRow( {
  slide,
  isExpanded,
  onToggle
}: {
  slide: SlideUI;
  isExpanded: boolean;
  onToggle: () => void;
} ) {
  return (
    <div>
      <button
        type="button"
        className={`w-full flex items-center gap-2 p-1.5 rounded-lg transition-all text-left ${
          slide.status === "active"
            ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
            : slide.status === "completed"
              ? "bg-green-50 dark:bg-green-900/10"
              : "bg-gray-50 dark:bg-gray-900/30"
        }`}
        onClick={onToggle}
      >
        <StatusIcon status={slide.status} index={slide.index} />

        <span className={`flex-1 text-xs font-medium truncate ${ statusTextClass( slide.status ) }`}>
          {slide.name}
        </span>

        {slide.status !== "pending" && (
          <span className={`text-[10px] font-semibold flex-shrink-0 ${
            slide.status === "completed"
              ? "text-green-600 dark:text-green-400"
              : "text-blue-600 dark:text-blue-400"
          }`}>
            {slide.status === "completed" ? "100" : slide.aggregate}%
          </span>
        )}

        <ChevronDown
          className={`w-3 h-3 text-foreground/40 flex-shrink-0 transition-transform ${ isExpanded ? "rotate-180" : "" }`}
        />
      </button>

      {isExpanded && (
        <div className="ml-7 mt-1 space-y-1">
          {slide.subSteps.map( ( sub ) => (
            <SubStepRow key={sub.key} step={sub} parentStatus={slide.status} />
          ) )}
        </div>
      )}
    </div>
  );
}

function SharedStepRow( {
  step
}: {
 step: FlatStepUI
} ) {
  const isDone = step.status === "completed";

  return (
    <div className={`flex items-center gap-2 p-1.5 rounded-lg ${
      isDone ? "bg-green-50 dark:bg-green-900/10" : "bg-gray-50 dark:bg-gray-900/30"
    }`}>
      <div className="w-5 h-5 flex-shrink-0">
        {isDone ? (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600" />
        )}
      </div>
      <span className={`text-xs flex-1 ${
        isDone ? "text-green-700 dark:text-green-300" : "text-gray-500 dark:text-gray-400"
      }`}>
        {step.label}
      </span>
      {isDone && (
        <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">100%</span>
      )}
    </div>
  );
}

function SubStepRow( {
  step,
  parentStatus
}: {
  step: FlatStepUI;
  parentStatus: StepUIStatus;
} ) {
  const isActive = parentStatus === "active" && step.percentage > 0 && step.percentage < 100;
  const isDone = step.percentage >= 100 || parentStatus === "completed";

  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        isDone ? "bg-green-500" : isActive ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
      }`} />
      <span className={`text-[11px] flex-1 ${
        isDone
          ? "text-green-700 dark:text-green-300"
          : isActive
            ? "text-blue-700 dark:text-blue-300"
            : "text-gray-500 dark:text-gray-400"
      }`}>
        {step.label}
      </span>
      {isActive && (
        <span className="text-[10px] text-blue-600 dark:text-blue-400">
          {Math.round( step.percentage )}%
        </span>
      )}
    </div>
  );
}

function FlatStepList( {
  steps
}: {
 steps: ProgressStep[]
} ) {
  return (
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

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`text-xs font-medium truncate ${
                step.status === "active"
                  ? "text-blue-700 dark:text-blue-300"
                  : step.status === "completed"
                    ? "text-green-700 dark:text-green-300"
                    : step.status === "error"
                      ? "text-red-700 dark:text-red-300"
                      : "text-gray-500 dark:text-gray-400"
              }`}>
                {step.name}
              </span>
              {step.percentage !== undefined && step.status === "active" && (
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  {step.percentage.toPrecision( 3 )}%
                </span>
              )}
            </div>

            {step.status === "active" && step.percentage !== undefined && (
              <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${ step.percentage }%`
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ) )}
    </>
  );
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

function StatusIcon( {
  status, index
}: {
 status: StepUIStatus; index: number
} ) {
  if ( status === "completed" ) {
    return (
      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
        <Check className="w-3 h-3 text-white" />
      </div>
    );
  }
  if ( status === "active" ) {
    return (
      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
        <Loader2 className="w-3 h-3 text-white animate-spin" />
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">
        {index + 1}
      </span>
    </div>
  );
}

function statusTextClass( status: StepUIStatus ): string {
  if ( status === "active" ) {
    return "text-blue-700 dark:text-blue-300";
  }
  if ( status === "completed" ) {
    return "text-green-700 dark:text-green-300";
  }
  return "text-gray-500 dark:text-gray-400";
}
