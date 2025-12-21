import {
  SketchOption
} from "@/types/sketch.types";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

import metadata from "@/p5-sketches/sketches/metadata.json";

type SketchMetadata = {
  name: string;
  category: string | null;
  hasSketchForm: boolean;
  mtime: string;
  ctime: string;
};

// Helper to get the full sketch path (with category if it exists)
function getSketchPath( sketchName: string ): string {
  const meta = ( metadata as SketchMetadata[] ).find( ( m ) => m.name === sketchName );

  if ( meta?.category ) {
    return `${ meta.category }/${ sketchName }`;
  }

  return sketchName;
}

export async function getJSONSketchOptions( sketchName: string ): Promise<Partial<SketchOption>> {
  try {
    const sketchPath = getSketchPath( sketchName );
    // Use dynamic import so it works in production builds
    const options = await import( `@/p5-sketches/sketches/${ sketchPath }/options.json` );

    return options.default || options;
  } catch ( error ) {
    return {
    };
  }
}

export type SketchMeta = {
  formValues?: Record<string, any>;
  formConfiguration?: Record<string, FieldConfig>;
};

export async function getSketchMeta( sketchName: string ): Promise<SketchMeta> {
  try {
    const sketchPath = getSketchPath( sketchName );

    return await import( `@/p5-sketches/sketches/${ sketchPath }/options.ts` );
  } catch ( error ) {
    // console.error(
    //   "error",
    //   error
    // );
    return {
    };
  }
}
