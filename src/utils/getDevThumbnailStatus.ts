import {
  getMetadata
} from "@/engines/metadata";

export function getDevThumbnailStatus(): {
  hasMissingThumbnails: boolean
} {
  if ( process.env.NODE_ENV !== "development" ) {
    return {
      hasMissingThumbnails: false
    };
  }

  try {
    const entries = getMetadata();
    const hasMissingThumbnails = entries.some( ( e ) => !e.hasThumbnail );

    return {
      hasMissingThumbnails
    };
  } catch {
    return {
      hasMissingThumbnails: true
    };
  }
}
