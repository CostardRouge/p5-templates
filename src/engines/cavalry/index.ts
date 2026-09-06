import type {
  EngineRegistration, SketchSummary
} from "@/engines/types";
import {
  CavalryEngine
} from "./CavalryEngine";
import {
  getEngineLabel
} from "@/engines/engineCatalog";
import {
  findSketchMeta, listSketchesForEngine
} from "@/engines/metadata";

export const cavalryRegistration: EngineRegistration = {
  id: "cavalry",
  label: getEngineLabel( "cavalry" ),

  createEngine: () => new CavalryEngine(),

  resolveSketchPath( sketchName: string ): string {
    const meta = findSketchMeta(
      sketchName,
      "cavalry"
    );

    if ( !meta ) {
      throw new Error( `Cavalry sketch "${ sketchName }" not found in metadata.` );
    }

    return meta.sketchPath;
  },

  listSketches(): SketchSummary[] {
    return listSketchesForEngine( "cavalry" ).map( ( m ) => ( {
      name: m.name,
      engine: m.engine,
      category: m.category,
      hasSketchForm: m.hasSketchForm,
      hasThumbnail: m.hasThumbnail
    } ) );
  }
};
