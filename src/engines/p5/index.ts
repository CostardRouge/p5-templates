import type {
  EngineRegistration, TemplateMetadata
} from "@/engines/types";
import {
  P5Engine
} from "./P5Engine";
import {
  getEngineLabel
} from "@/engines/engineCatalog";
import {
  findSketchMeta, listTemplatesForEngine
} from "@/engines/metadata";

export const p5Registration: EngineRegistration = {
  id: "p5",
  label: getEngineLabel( "p5" ),

  createEngine: () => new P5Engine(),

  resolveTemplatePath( sketchName: string ): string {
    const meta = findSketchMeta(
      sketchName,
      "p5"
    );

    if ( !meta ) {
      throw new Error( `P5 template "${ sketchName }" not found in metadata.` );
    }

    return meta.sketchPath;
  },

  listTemplates(): TemplateMetadata[] {
    return listTemplatesForEngine( "p5" ).map( ( m ) => ( {
      name: m.name,
      engine: m.engine,
      category: m.category,
      hasSketchForm: m.hasSketchForm,
      hasThumbnail: m.hasThumbnail
    } ) );
  }
};
