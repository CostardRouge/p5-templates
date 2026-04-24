import {
  SketchOption
} from "@/types/sketch.types";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

import {
  resolveSketchPath
} from "@/engines/metadata";

export async function getJSONSketchOptions( sketchName: string ): Promise<Partial<SketchOption>> {
  try {
    const sketchPath = resolveSketchPath( sketchName );
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
    const sketchPath = resolveSketchPath( sketchName );

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
