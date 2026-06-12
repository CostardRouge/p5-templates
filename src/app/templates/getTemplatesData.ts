import {
  ENGINE_LABELS
} from "@/engines/engineCatalog";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";
import getSketchPreviewURL from "@/utils/getSketchPreviewURL";
import getSketchList from "@/utils/getSketchList";

export type TemplateItem = {
  href: string;
  name: string;
  thumbnail: string;
  preview: string | null;
  previewMd: string | null;
  hasSketchForm: boolean;
  category?: string | null;
  hiddenFromHome?: boolean;
  hiddenFromTemplates?: boolean;
  mtime?: string;
};

export async function getTemplatesData() {
  const allSketches = ( await getSketchList() ) ?? [];

  const templatesByEngine: Record<string, TemplateItem[]> = {};

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
      hiddenFromTemplates,
      mtime
    } ) => {
      if ( !templatesByEngine[ engine ] ) {
        templatesByEngine[ engine ] = [];
      }

      templatesByEngine[ engine ].push( {
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
          ? `/templates/${ engine }/${ category }/${ name }`
          : `/templates/${ engine }/${ name }`,
        hasSketchForm,
        name,
        category,
        hiddenFromHome,
        hiddenFromTemplates,
        mtime
      } );
    } );

  // Labels come from the static catalogue rather than the engine runtime, so
  // the gallery/home/listing pages don't compile the whole engine graph (and
  // the generated sketch registry) just to render "p5.js" / "GSAP".
  return {
    templatesByEngine,
    engineLabels: ENGINE_LABELS
  };
}

/**
 * Filter for the /templates page (and engine sub-pages):
 *   - production → drop entries marked `.hidden-template`
 *   - development → keep them all so they can be rendered grayed out
 */
export function filterTemplatesForGallery( templatesByEngine: Record<string, TemplateItem[]> ): Record<string, TemplateItem[]> {
  if ( process.env.NODE_ENV !== "production" ) {
    return templatesByEngine;
  }

  return Object.fromEntries( Object.entries( templatesByEngine ).map( ( [
    engine,
    items
  ] ) => [
    engine,
    items.filter( ( t ) => !t.hiddenFromTemplates )
  ] ) );
}
