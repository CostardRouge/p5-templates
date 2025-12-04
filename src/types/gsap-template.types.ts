/**
 * Type definitions for GSAP-based HTML templates
 */

/**
 * Base animation configuration that all GSAP templates must include
 */
export interface GSAPAnimationOptions {
  duration: number;      // Total duration in seconds
  framerate: number;     // Frames per second for recording
}

/**
 * Base options interface that all GSAP templates must extend
 */
export interface GSAPTemplateOptions {
  animation: GSAPAnimationOptions;
  [key: string]: any;  // Template-specific options
}

/**
 * Metadata for a GSAP template
 */
export interface GSAPTemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: 'photo' | 'text' | 'motion' | 'mixed';
  thumbnail: string;
  defaultOptions: GSAPTemplateOptions;
}

/**
 * Request payload for capturing a GSAP template
 */
export interface CaptureRequest {
  template: string;
  options: GSAPTemplateOptions;
  outputFormat: 'video' | 'frames' | 'gif';
}

/**
 * Progress information during capture
 */
export interface CaptureProgress {
  currentFrame: number;
  totalFrames: number;
  progress: number;
  status: 'initializing' | 'capturing' | 'encoding' | 'complete' | 'error';
  message?: string;
}

/**
 * State for timeline synchronization
 */
export interface TimelineSyncState {
  timeline: gsap.core.Timeline | null;
  currentFrame: number;
  totalFrames: number;
  progress: number;
  isCapturing: boolean;
  isReady: boolean;
}

/**
 * Custom event detail for frame seeking
 */
export interface CaptureSeekFrameDetail {
  frame: number;
}

/**
 * Options for the useGSAPTimeline hook
 */
export interface UseGSAPTimelineOptions {
  container: React.RefObject<HTMLElement>;
  options?: GSAPAnimationOptions;
  capturing: boolean;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
}

/**
 * Return value from useGSAPTimeline hook
 */
export interface UseGSAPTimelineReturn {
  timeline: gsap.core.Timeline | null;
  progress: number;
  isReady: boolean;
  currentFrame: number;
  totalFrames: number;
}
