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
import {
  interactionFormValues, interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

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
    const loaded = await loaders.loadSketchForm( meta.sketchPath ) as SketchMeta;

    // Surface the shared Interaction block on every sketch that doesn't declare
    // its own. This seeds `sketch.interaction` (so the channel sampler can read
    // hands / audio / orbit / … live) AND adds the classic Interaction settings
    // panel to the form. Each sketch gets its own clone of the values so runtime
    // edits never leak across sketches; the config is static and shared.
    // Sketches that declare their own `interaction` (e.g. interaction-test) are
    // left untouched.
    //
    // `loaded` is the dynamic-import module namespace — its exports are
    // read-only getters, so we build a fresh meta object rather than assigning
    // onto it (assigning throws, which the catch below would turn into a sketch
    // with no form at all).
    return {
      formValues:
        loaded.formValues && !loaded.formValues.interaction
          ? {
            ...loaded.formValues,
            interaction: structuredClone( interactionFormValues )
          }
          : loaded.formValues,
      formConfiguration:
        loaded.formConfiguration && !loaded.formConfiguration.interaction
          ? {
            ...loaded.formConfiguration,
            // `defaults.js` is untyped (component fields widen to `string`);
            // the config is the canonical interaction panel, so assert the shape.
            interaction: interactionFormConfiguration as unknown as FieldConfig
          }
          : loaded.formConfiguration
    };
  } catch {
    return {};
  }
}
