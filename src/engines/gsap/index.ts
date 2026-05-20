import type {
  EngineRegistration, TemplateMetadata
} from "@/engines/types";
import {
  GsapEngine
} from "./GsapEngine";
import {
  findSketchMeta, listTemplatesForEngine
} from "@/engines/metadata";

export const gsapRegistration: EngineRegistration = {
  id: "gsap",
  label: "GSAP",

  createEngine: () => new GsapEngine(),

  resolveTemplatePath( sketchName: string ): string {
    const meta = findSketchMeta(
      sketchName,
      "gsap"
    );

    if ( !meta ) {
      throw new Error( `GSAP template "${ sketchName }" not found in metadata.` );
    }

    return meta.sketchPath;
  },

  listTemplates(): TemplateMetadata[] {
    return listTemplatesForEngine( "gsap" ).map( ( m ) => ( {
      name: m.name,
      engine: m.engine,
      category: m.category,
      hasSketchForm: m.hasSketchForm,
      hasThumbnail: m.hasThumbnail
    } ) );
  }
};
