import type {
  JobModel
} from "@/types/recording.types";

/**
 * Get the number of slides in a recording job
 * Handles both array format and Record<slideId, url> format
 */
export function getSlideCount( job: JobModel ): number {
  // Try videoUrls first (most reliable for completed recordings)
  if ( job.videoUrls ) {
    const videoData = job.videoUrls as unknown;

    if ( Array.isArray( videoData ) ) {
      return videoData.length;
    }
  }

  // Fall back to thumbnails
  if ( job.thumbnails ) {
    const thumbData = job.thumbnails as unknown;

    if ( Array.isArray( thumbData ) ) {
      return thumbData.length;
    } else if ( typeof thumbData === "object" && thumbData !== null ) {
      // Record<slideId, url> format
      return Object.keys( thumbData as Record<string, unknown> ).length;
    }
  }

  // Default to 1 slide
  return 1;
}
