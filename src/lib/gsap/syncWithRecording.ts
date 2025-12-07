/**
 * Frame synchronization utilities for GSAP timeline capture
 */

import type { GSAPAnimationOptions, CaptureSeekFrameDetail } from './types';

/**
 * Calculate total frames for an animation
 */
export function calculateTotalFrames(options: GSAPAnimationOptions): number {
  return Math.ceil(options.duration * options.framerate);
}

/**
 * Calculate progress (0-1) for a given frame number
 */
export function calculateProgress(
  frameNumber: number,
  totalFrames: number
): number {
  if (totalFrames === 0) return 0;
  return Math.min(1, Math.max(0, frameNumber / totalFrames));
}

/**
 * Calculate frame number from progress (0-1)
 */
export function calculateFrameFromProgress(
  progress: number,
  totalFrames: number
): number {
  return Math.floor(progress * totalFrames);
}

/**
 * Set up frame synchronization for a GSAP timeline in capture mode
 * This listens for 'capture:seek-frame' events and updates the timeline accordingly
 */
export function setupFrameSync(
  timeline: gsap.core.Timeline,
  options: GSAPAnimationOptions,
  onFrameUpdate?: (frame: number, progress: number) => void
): () => void {
  const totalFrames = calculateTotalFrames(options);

  const handleSeekFrame = ((event: CustomEvent<CaptureSeekFrameDetail>) => {
    const frameNumber = event.detail.frame;
    const progress = calculateProgress(frameNumber, totalFrames);
    
    // Seek timeline to the exact progress
    timeline.progress(progress);
    
    // Call optional callback
    onFrameUpdate?.(frameNumber, progress);
  }) as EventListener;

  // Listen for frame seek events
  window.addEventListener('capture:seek-frame', handleSeekFrame);

  // Return cleanup function
  return () => {
    window.removeEventListener('capture:seek-frame', handleSeekFrame);
  };
}

/**
 * Dispatch a frame seek event (used by capture system)
 */
export function dispatchSeekFrame(frameNumber: number): void {
  window.dispatchEvent(
    new CustomEvent<CaptureSeekFrameDetail>('capture:seek-frame', {
      detail: { frame: frameNumber },
    })
  );
}

/**
 * Wait for timeline to be ready for capture
 * Checks for data-ready attribute on the container
 */
export async function waitForCaptureReady(
  container: HTMLElement,
  timeoutMs: number = 10000
): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkReady = () => {
      if (container.getAttribute('data-ready') === 'true') {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('Timeout waiting for capture ready'));
        return;
      }

      requestAnimationFrame(checkReady);
    };

    checkReady();
  });
}

/**
 * Signal that capture is complete
 */
export function signalCaptureComplete(): void {
  document.body.setAttribute('data-capture-complete', 'true');
}

/**
 * Check if currently in capture mode
 */
export function isCapturing(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('capturing') || params.get('capturing') === 'true';
}
