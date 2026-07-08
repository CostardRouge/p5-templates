import type {
  EngineRegistration, SketchSummary
} from "@/engines/types";
import {
  GsapEngine
} from "./GsapEngine";
import {
  getEngineLabel
} from "@/engines/engineCatalog";
import {
  findSketchMeta, listSketchesForEngine
} from "@/engines/metadata";

export const gsapRegistration: EngineRegistration = {
  id: "gsap",
  label: getEngineLabel( "gsap" ),

  createEngine: () => new GsapEngine(),

  resolveSketchPath( sketchName: string ): string {
    const meta = findSketchMeta(
      sketchName,
      "gsap"
    );

    if ( !meta ) {
      throw new Error( `GSAP sketch "${ sketchName }" not found in metadata.` );
    }

    return meta.sketchPath;
  },

  listSketches(): SketchSummary[] {
    return listSketchesForEngine( "gsap" ).map( ( m ) => ( {
      name: m.name,
      engine: m.engine,
      category: m.category,
      hasSketchForm: m.hasSketchForm,
      hasThumbnail: m.hasThumbnail
    } ) );
  }
};
