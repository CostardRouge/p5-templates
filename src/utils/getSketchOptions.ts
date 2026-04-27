import {
  SketchOption
} from "@/types/sketch.types";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

import {
  findSketchMeta, resolveSketchPath
} from "@/engines/metadata";

export async function getJSONSketchOptions( sketchName: string, engineId: string ): Promise<Partial<SketchOption>> {
  try {
    const sketchPath = resolveSketchPath( sketchName, engineId );

    if ( !sketchPath ) {
      return {
      };
    }

    const options = await import(
      /* webpackInclude: /options\.json$/ */
      `@/p5/sketches/${ sketchPath }/options.json`
    );

    return options.default || options;
  } catch {
    return {
    };
  }
}

export type SketchMeta = {
  formValues?: Record<string, any>;
  formConfiguration?: Record<string, FieldConfig>;
};

export async function getSketchMeta( sketchName: string, engineId: string ): Promise<SketchMeta> {
  const meta = findSketchMeta( sketchName, engineId );

  if ( !meta?.hasSketchForm ) {
    return {
    };
  }

  try {
    return await import(
      /* webpackInclude: /options\.ts$/ */
      `@/p5/sketches/${ meta.sketchPath }/options.ts`
    );
  } catch {
    return {
    };
  }
}
