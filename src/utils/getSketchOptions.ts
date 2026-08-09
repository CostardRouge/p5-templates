import {
  SketchOption
} from "@/types/sketch.types";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

import {
  findSketchMeta, resolveSketchPath
} from "@/engines/metadata";
import {
  getSketchOptionLoaders
} from "@/engines/sketchOptionLoaders";
import {
  interactionBindingsEnabled
} from "@/lib/interactionBindings";

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

    // The interaction-bindings plugin is off by default — most sketches pay
    // nothing, and we never even load the defaults module.
    if ( !interactionBindingsEnabled() ) {
      return loaded;
    }

    // Only the CONFIG (the panel schema) is injected — never values. Values
    // for the plugin-managed block live in the top-level `interactive`
    // namespace, seeded lazily client-side the first time a binding picks a
    // live input source (see BindingAffordance.enableSourceInputs); legacy
    // `sketch.bindings` are relocated there on load by initOptions. Sketches
    // that declare their own `interaction` config (hand-tracking, audio, …)
    // are left untouched — theirs is a real sketch parameter, edited at the
    // sketch scope and read by their own sketch code.
    const needConfig = !!loaded.formConfiguration && !loaded.formConfiguration.interaction;

    if ( !needConfig ) {
      return loaded;
    }

    // Loaded lazily so a plugin-off build never pulls the panel/defaults
    // module in.
    //
    // `loaded` is the dynamic-import module namespace — its exports are
    // read-only getters, so we build a fresh meta object rather than assigning
    // onto it (assigning throws, which the catch below would turn into a sketch
    // with no form at all).
    const {
      interactionFormConfiguration
    } = await import( "@/p5/utils/interaction/defaults.js" );

    return {
      formValues: loaded.formValues,
      formConfiguration: {
        ...loaded.formConfiguration,
        // `managed: true` marks this as the plugin-injected panel (vs a
        // sketch-declared one): the form renders it against the `interactive`
        // namespace and only while a binding needs it. `defaults.js` is
        // untyped (component fields widen to `string`); the config is the
        // canonical interaction panel, so assert the shape.
        interaction: {
          ...( interactionFormConfiguration as unknown as Record<string, unknown> ),
          managed: true
        } as unknown as FieldConfig
      }
    };
  } catch {
    return {};
  }
}
