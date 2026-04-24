import type {
  EngineRegistration, TemplateMetadata
} from "@/engines/types";
import {
  P5Engine
} from "./P5Engine";
import {
  findSketchMeta, listTemplatesForEngine, resolveSketchPath,
} from "@/engines/metadata";

export const p5Registration: EngineRegistration = {
  id: "p5",
  label: "p5.js",

  createEngine: () => new P5Engine(),

  resolveTemplatePath( sketchName: string ): string {
    const meta = findSketchMeta(
      sketchName,
      "p5",
    );

    if ( !meta ) {
      throw new Error( `P5 template "${ sketchName }" not found in metadata.` );
    }

    return resolveSketchPath(
      sketchName,
      "p5",
    );
  },

  listTemplates(): TemplateMetadata[] {
    return listTemplatesForEngine( "p5" ).map( ( m ) => ( {
      name: m.name,
      engine: m.engine,
      category: m.category,
      hasSketchForm: m.hasSketchForm,
      hasThumbnail: m.hasThumbnail,
    } ) );
  },
};
