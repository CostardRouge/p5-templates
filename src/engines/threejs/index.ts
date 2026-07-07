import type {
  EngineRegistration, SketchSummary
} from "@/engines/types";
import {
  ThreeEngine
} from "./ThreeEngine";
import {
  getEngineLabel
} from "@/engines/engineCatalog";
import {
  findSketchMeta, listSketchesForEngine
} from "@/engines/metadata";

export const threejsRegistration: EngineRegistration = {
  id: "threejs",
  label: getEngineLabel( "threejs" ),

  createEngine: () => new ThreeEngine(),

  resolveSketchPath( sketchName: string ): string {
    const meta = findSketchMeta(
      sketchName,
      "threejs"
    );

    if ( !meta ) {
      throw new Error( `Three.js sketch "${ sketchName }" not found in metadata.` );
    }

    return meta.sketchPath;
  },

  listSketches(): SketchSummary[] {
    return listSketchesForEngine( "threejs" ).map( ( m ) => ( {
      name: m.name,
      engine: m.engine,
      category: m.category,
      hasSketchForm: m.hasSketchForm,
      hasThumbnail: m.hasThumbnail
    } ) );
  }
};
