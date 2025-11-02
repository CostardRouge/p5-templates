import fs from "fs";
import path from "path";

import {
  SKETCHES_DIRECTORY
} from "@/constants";
import {
  SketchOption
} from "@/types/sketch.types";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export function getJSONSketchOptions( sketchName: string ): Partial<SketchOption> {
  try {
    return JSON.parse( fs.readFileSync(
      path.join(
        SKETCHES_DIRECTORY,
        sketchName,
        "options.json"
      ),
      "utf8"
    ) );
  }
  catch ( error ) {
    return {
    };
  }
}

export type SketchMeta = {
  formValues?: Record<string, any>,
  formConfiguration?: Record<string, FieldConfig>
}

export async function getSketchMeta( sketchName: string ): Promise<SketchMeta> {
  try {
    return await import( `@/p5-sketches/sketches/${ sketchName }/options.ts` );
  } catch ( error ) {
    return {
    };
  }
}