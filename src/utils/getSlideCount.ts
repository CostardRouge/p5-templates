import type {
  JobModel
} from "@/types/recording.types";

/**
 * Get the number of slides in a recording job
 * Handles both array format and Record<slideId, url> format
 */
export function getSlideCount( job: JobModel ): number {
  // Check options first (authoritative source for intended slide count)
  if ( job.options ) {
    const options = job.options as unknown;

    if (
      typeof options === "object" &&
      options !== null &&
      "slides" in options
    ) {
      const slides = ( options as any ).slides;

      if ( Array.isArray( slides ) ) {
        return slides.length || 1;
      }
    }
  }

  // For completed recordings, videoUrls should match options but use as final confirmation
  if ( job.videoUrls ) {
    const videoData = job.videoUrls as unknown;

    if ( Array.isArray( videoData ) ) {
      return videoData.length;
    }
  }

  return 1;
}
