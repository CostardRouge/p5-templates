import {
  ENGINE_LABELS
} from "@/engines/engineCatalog";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";
import getSketchPreviewURL from "@/utils/getSketchPreviewURL";
import getSketchList from "@/utils/getSketchList";

export type SketchItem = {
  href: string;
  name: string;
  thumbnail: string;
  preview: string | null;
  previewMd: string | null;
  hasSketchForm: boolean;
  category?: string | null;
  hiddenFromHome?: boolean;
  hiddenFromGallery?: boolean;
  mtime?: string;
};

export async function getSketchesData() {
  const allSketches = ( await getSketchList() ) ?? [];

  const sketchesByEngine: Record<string, SketchItem[]> = {};

  allSketches
    .slice()
    .reverse()
    .forEach( ( {
      name,
      engine,
      category,
      hasSketchForm,
      hasPreview,
      hiddenFromHome,
      hiddenFromGallery,
      mtime
    } ) => {
      if ( !sketchesByEngine[ engine ] ) {
        sketchesByEngine[ engine ] = [];
      }

      sketchesByEngine[ engine ].push( {
        thumbnail: getSketchThumbnailURL(
          engine,
          name
        ),
        preview: hasPreview ? getSketchPreviewURL(
          engine,
          name
        ) : null,
        previewMd: hasPreview ? getSketchPreviewURL(
          engine,
          name,
          "md"
        ) : null,
        href: category
          ? `/sketches/${ engine }/${ category }/${ name }`
          : `/sketches/${ engine }/${ name }`,
        hasSketchForm,
        name,
        category,
        hiddenFromHome,
        hiddenFromGallery,
        mtime
      } );
    } );

  // Labels come from the static catalogue rather than the engine runtime, so
  // the gallery/home/listing pages don't compile the whole engine graph (and
  // the generated sketch registry) just to render "p5.js" / "GSAP".
  return {
    sketchesByEngine,
    engineLabels: ENGINE_LABELS
  };
}

/**
 * Filter for the /sketches page (and engine sub-pages):
 *   - production → drop entries marked `.hidden-template`
 *   - development → keep them all so they can be rendered grayed out
 */
export function filterSketchesForGallery( sketchesByEngine: Record<string, SketchItem[]> ): Record<string, SketchItem[]> {
  if ( process.env.NODE_ENV !== "production" ) {
    return sketchesByEngine;
  }

  return Object.fromEntries( Object.entries( sketchesByEngine ).map( ( [
    engine,
    items
  ] ) => [
    engine,
    items.filter( ( t ) => !t.hiddenFromGallery )
  ] ) );
}
