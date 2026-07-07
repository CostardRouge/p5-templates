import type {
  EngineRegistration, SketchSummary
} from "@/engines/types";
import {
  P5Engine
} from "./P5Engine";
import {
  getEngineLabel
} from "@/engines/engineCatalog";
import {
  findSketchMeta, listSketchesForEngine
} from "@/engines/metadata";

export const p5Registration: EngineRegistration = {
  id: "p5",
  label: getEngineLabel( "p5" ),

  createEngine: () => new P5Engine(),

  resolveSketchPath( sketchName: string ): string {
    const meta = findSketchMeta(
      sketchName,
      "p5"
    );

    if ( !meta ) {
      throw new Error( `P5 sketch "${ sketchName }" not found in metadata.` );
    }

    return meta.sketchPath;
  },

  listSketches(): SketchSummary[] {
    return listSketchesForEngine( "p5" ).map( ( m ) => ( {
      name: m.name,
      engine: m.engine,
      category: m.category,
      hasSketchForm: m.hasSketchForm,
      hasThumbnail: m.hasThumbnail
    } ) );
  }
};
