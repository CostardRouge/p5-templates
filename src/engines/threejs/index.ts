import type {
  EngineRegistration, TemplateMetadata
} from "@/engines/types";
import {
  ThreeEngine
} from "./ThreeEngine";
import {
  getEngineLabel
} from "@/engines/engineCatalog";
import {
  findSketchMeta, listTemplatesForEngine
} from "@/engines/metadata";

export const threejsRegistration: EngineRegistration = {
  id: "threejs",
  label: getEngineLabel( "threejs" ),

  createEngine: () => new ThreeEngine(),

  resolveTemplatePath( sketchName: string ): string {
    const meta = findSketchMeta(
      sketchName,
      "threejs"
    );

    if ( !meta ) {
      throw new Error( `Three.js template "${ sketchName }" not found in metadata.` );
    }

    return meta.sketchPath;
  },

  listTemplates(): TemplateMetadata[] {
    return listTemplatesForEngine( "threejs" ).map( ( m ) => ( {
      name: m.name,
      engine: m.engine,
      category: m.category,
      hasSketchForm: m.hasSketchForm,
      hasThumbnail: m.hasThumbnail
    } ) );
  }
};
