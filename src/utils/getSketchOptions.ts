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

    const needConfig = !!loaded.formConfiguration && !loaded.formConfiguration.interaction;

    // Only seed the actual VALUES when this sketch already ships bindings
    // that need them (e.g. a demo sketch with default `bindings` pointing at
    // a live input) — most sketches have none at load time, and get the block
    // seeded lazily client-side the first time a binding picks a live input
    // source (see BindingAffordance.enableSourceInputs). The schema
    // (formConfiguration) is still added unconditionally: it's a static, cheap
    // field descriptor with no runtime cost, and the client needs it available
    // to render the panel once a binding actually requires it. `bindings.js` is
    // a small pure module (no MediaPipe/DOM), but still dynamic-imported here
    // — like defaults.js below — so a plugin-off build never pulls either in.
    const {
      needsInteractionBlock
    } = await import( "@/p5/utils/interaction/bindings.js" );
    const needValues = !!loaded.formValues &&
      !loaded.formValues.interaction &&
      needsInteractionBlock( loaded.formValues.bindings );

    if ( !needValues && !needConfig ) {
      return loaded;
    }

    // Loaded lazily so a plugin-off build never pulls the panel/defaults
    // module in. Each sketch gets its own clone of the values so runtime
    // edits never leak across sketches; the config is static and shared.
    // Sketches that declare their own `interaction` (e.g. interaction-test)
    // are left untouched.
    //
    // `loaded` is the dynamic-import module namespace — its exports are
    // read-only getters, so we build a fresh meta object rather than assigning
    // onto it (assigning throws, which the catch below would turn into a sketch
    // with no form at all).
    const {
      inertInteractionFormValues, interactionFormConfiguration
    } = await import( "@/p5/utils/interaction/defaults.js" );

    return {
      formValues: needValues
        ? {
          ...loaded.formValues,
          interaction: inertInteractionFormValues()
        }
        : loaded.formValues,
      formConfiguration: needConfig
        ? {
          ...loaded.formConfiguration,
          // `defaults.js` is untyped (component fields widen to `string`); the
          // config is the canonical interaction panel, so assert the shape.
          interaction: interactionFormConfiguration as unknown as FieldConfig
        }
        : loaded.formConfiguration
    };
  } catch {
    return {};
  }
}
