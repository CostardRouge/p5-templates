import {
  listEngines
} from "@/engines/index";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";
import getSketchPreviewURL from "@/utils/getSketchPreviewURL";
import getSketchList from "@/utils/getSketchList";

export type TemplateItem = {
  href: string;
  name: string;
  thumbnail: string;
  preview: string | null;
  hasSketchForm: boolean;
  category?: string | null;
};

export async function getTemplatesData() {
  const allSketches = ( await getSketchList() ) ?? [];

  const templatesByEngine: Record<string, TemplateItem[]> = {};

  allSketches
    .slice()
    .reverse()
    .forEach( ( {
      name, engine, category, hasSketchForm, hasPreview
    } ) => {
      if ( !templatesByEngine[ engine ] ) {
        templatesByEngine[ engine ] = [];
      }

      templatesByEngine[ engine ].push( {
        thumbnail: getSketchThumbnailURL(
          engine,
          name
        ),
        preview: hasPreview ? getSketchPreviewURL( engine, name ) : null,
        href: category
          ? `/templates/${ engine }/${ category }/${ name }`
          : `/templates/${ engine }/${ name }`,
        hasSketchForm,
        name,
        category
      } );
    } );

  const engines = listEngines();
  const engineLabels: Record<string, string> = {};

  engines.forEach( ( e ) => {
    engineLabels[ e.id ] = e.label;
  } );

  return {
    templatesByEngine,
    engineLabels
  };
}
