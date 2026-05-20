import {
  getMetadata
} from "@/engines/metadata";

export function getDevPreviewStatus(): {
  hasMissingPreviews: boolean
} {
  if ( process.env.NODE_ENV !== "development" ) {
    return {
      hasMissingPreviews: false
    };
  }

  try {
    const entries = getMetadata();
    const hasMissingPreviews = entries.some( ( e ) => !e.hasPreview );

    return {
      hasMissingPreviews
    };
  } catch {
    return {
      hasMissingPreviews: true
    };
  }
}
