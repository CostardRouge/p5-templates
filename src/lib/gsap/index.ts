/**
 * GSAP template infrastructure
 * 
 * This module provides utilities for creating HTML-based animation templates
 * using React, GSAP, and Tailwind CSS that synchronize with the recording infrastructure.
 */

export { useGSAPTimeline } from './useGSAPTimeline';
export {
  setupFrameSync,
  calculateTotalFrames,
  calculateProgress,
  calculateFrameFromProgress,
  dispatchSeekFrame,
  waitForCaptureReady,
  signalCaptureComplete,
  isCapturing,
} from './syncWithRecording';
export * from './types';
