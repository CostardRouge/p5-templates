import {
  SketchOption
} from "@/types/sketch.types";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

import {
  findSketchMeta, resolveSketchPath
} from "@/engines/metadata";
import {
  getSketchOptionLoaders
} from "@/engines/sketchOptionLoaders";

export async function getJSONSketchOptions(
  sketchName: string, engineId: string
): Promise<Partial<SketchOption>> {
  try {
    const sketchPath = resolveSketchPath(
      sketchName,
      engineId
    );

    const loaders = getSketchOptionLoaders( engineId );

    if ( !sketchPath || !loaders ) {
      return {};
    }

    // Loading happens in a server-only module: some `options.ts`/`.json`
    // siblings touch the filesystem at import time, so the dynamic-import
    // context must never reach the client bundle. See sketchOptionLoaders.ts.
    const options = await loaders.loadOptionsJson( sketchPath );

    return ( options as Partial<SketchOption> ) ?? {};
  } catch {
    return {};
  }
}

export type SketchMeta = {
  formValues?: Record<string, any>;
  formConfiguration?: Record<string, FieldConfig>;
};

export async function getSketchMeta(
  sketchName: string, engineId: string
): Promise<SketchMeta> {
  const meta = findSketchMeta(
    sketchName,
    engineId
  );

  if ( !meta?.hasSketchForm ) {
    return {};
  }

  const loaders = getSketchOptionLoaders( engineId );

  if ( !loaders ) {
    return {};
  }

  try {
    return await loaders.loadSketchForm( meta.sketchPath ) as SketchMeta;
  } catch {
    return {};
  }
}
