"use client";

/**
 * React hook for managing GSAP timelines synchronized with recording infrastructure
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import type { UseGSAPTimelineOptions, UseGSAPTimelineReturn } from './types';
import { 
  setupFrameSync, 
  calculateTotalFrames, 
  signalCaptureComplete 
} from './syncWithRecording';

/**
 * Hook for creating and managing a GSAP timeline synchronized with animation options
 * 
 * In interactive mode: Timeline plays normally
 * In capture mode: Timeline is controlled frame-by-frame via events
 * 
 * @param options - Configuration for the timeline
 * @returns Timeline instance, progress, and ready state
 */
export function useGSAPTimeline({
  container,
  options,
  capturing,
  onComplete,
  onUpdate,
}: UseGSAPTimelineOptions): UseGSAPTimelineReturn {
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);

  // Handle progress updates
  const handleProgressUpdate = useCallback((tl: gsap.core.Timeline) => {
    const newProgress = tl.progress();
    setProgress(newProgress);
    onUpdate?.(newProgress);
  }, [onUpdate]);

  // Handle completion
  const handleComplete = useCallback(() => {
    if (capturing) {
      signalCaptureComplete();
    }
    onComplete?.();
  }, [capturing, onComplete]);

  // Create and configure timeline
  useEffect(() => {
    if (!container.current || !options) {
      setIsReady(false);
      return;
    }

    const frames = calculateTotalFrames(options);
    setTotalFrames(frames);

    // Create timeline with duration from options
    const tl = gsap.timeline({
      paused: true,
      onUpdate: () => {
        if (timelineRef.current) {
          handleProgressUpdate(timelineRef.current);
        }
      },
      onComplete: handleComplete,
    });
    
    // Set the timeline duration to match animation options
    tl.duration(options.duration);

    timelineRef.current = tl;
    setIsReady(true);

    // Set up frame synchronization or playback based on mode
    if (capturing) {
      // In capture mode, sync timeline to frame events
      const cleanup = setupFrameSync(tl, options, (frame, prog) => {
        setCurrentFrame(frame);
        setProgress(prog);
      });
      cleanupRef.current = cleanup;
    } else {
      // In interactive mode, play the timeline
      tl.play();
    }

    // Cleanup function
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
      setIsReady(false);
      setProgress(0);
      setCurrentFrame(0);
    };
  }, [container, options, capturing, handleProgressUpdate, handleComplete]);

  return {
    timeline: timelineRef.current,
    progress,
    isReady,
    currentFrame,
    totalFrames,
  };
}
