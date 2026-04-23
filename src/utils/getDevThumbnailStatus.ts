import fs from "node:fs";
import path from "node:path";

type SketchMeta = {
  name: string;
  hasThumbnail?: boolean;
};

export function getDevThumbnailStatus(): { hasMissingThumbnails: boolean } {
  if ( process.env.NODE_ENV !== "development" ) {
    return { hasMissingThumbnails: false };
  }

  try {
    const metadataPath = path.join( process.cwd(), "src/p5-sketches/sketches/metadata.json" );
    const raw = fs.readFileSync( metadataPath, "utf-8" );
    const entries = JSON.parse( raw ) as SketchMeta[];
    const hasMissingThumbnails = entries.some( ( e ) => !e.hasThumbnail );

    return { hasMissingThumbnails };
  } catch {
    return { hasMissingThumbnails: true };
  }
}
