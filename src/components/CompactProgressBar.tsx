'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, ChevronUp } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { JobModel } from '@/types/recording.types';

export interface ProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  percentage?: number;
}

interface CompactProgressBarProps {
  job: JobModel;
  steps?: ProgressStep[];
  startTime?: number;
  className?: string;
}

export default function CompactProgressBar({
  job,
  steps = [],
  startTime,
  className = '',
}: CompactProgressBarProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!startTime || job.status !== 'active') return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, job.status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentStep = steps.find(s => s.status === 'active');
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const isActive = job.status === 'active' || job.status === 'queued';
  const progress = job.progress || 0;

  // For completed recordings, show simple green progress bar
  if (job.status === 'completed') {
    return (
      <div className={`w-full ${className}`}>
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

  // For draft/failed/cancelled recordings, show simple gray progress bar
  if (!isActive) {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-foreground/50 capitalize">{job.status}</span>
          <span className="text-foreground/60 font-semibold">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-400 dark:bg-gray-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <Popover className={`relative w-full ${className}`}>
      {({ open }) => (
        <>
          <PopoverButton 
            className="w-full text-left hover:opacity-80 transition-opacity focus:outline-none"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-2">
                {currentStep && (
                  <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                )}
                <span className="text-foreground/70 truncate">
                  {currentStep?.name || 'Processing...'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {startTime && (
                  <span className="text-foreground/50 font-mono text-[10px]">
                    {formatTime(elapsedTime)}
                  </span>
                )}
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  {progress}%
                </span>
                {steps.length > 0 && (
                  <ChevronUp
                    className={`w-3 h-3 text-foreground/40 transition-transform ${
                      open ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </div>
            </div>

            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            {steps.length > 0 && (
              <div className="text-[10px] text-foreground/40 mt-1">
                Step {completedSteps + 1} of {steps.length} • {completedSteps} completed
              </div>
            )}
          </PopoverButton>

          {steps.length > 0 && (
            <PopoverPanel
              anchor="bottom start"
              className="z-50 w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl p-3 space-y-2 [--anchor-gap:0.5rem] [--anchor-padding:0.5rem]"
            >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
              <div>
                <div className="text-xs font-semibold text-foreground">Recording Progress</div>
                <div className="text-[10px] text-foreground/50 font-mono">#{job.id.slice(0, 8)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400">{progress}%</div>
                {startTime && (
                  <div className="text-[10px] text-foreground/50 font-mono">{formatTime(elapsedTime)}</div>
                )}
              </div>
            </div>

            {/* Steps List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-2 p-2 rounded-lg transition-all ${
                    step.status === 'active'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : step.status === 'completed'
                      ? 'bg-green-50 dark:bg-green-900/10'
                      : 'bg-gray-50 dark:bg-gray-900/30'
                  }`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {step.status === 'completed' && (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {step.status === 'active' && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      </div>
                    )}
                    {step.status === 'pending' && (
                      <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">
                          {index + 1}
                        </span>
                      </div>
                    )}
                    {step.status === 'error' && (
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
                          step.status === 'active'
                            ? 'text-blue-700 dark:text-blue-300'
                            : step.status === 'completed'
                            ? 'text-green-700 dark:text-green-300'
                            : step.status === 'error'
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {step.name}
                      </span>
                      {step.percentage !== undefined && step.status === 'active' && (
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          {step.percentage.toPrecision(3)}%
                        </span>
                      )}
                    </div>

                    {/* Step Progress Bar */}
                    {step.status === 'active' && step.percentage !== undefined && (
                      <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${step.percentage}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </PopoverPanel>
          )}
        </>
      )}
    </Popover>
  );
}
