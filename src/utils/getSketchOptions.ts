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

    const needValues = !!loaded.formValues && !loaded.formValues.interaction;
    const needConfig = !!loaded.formConfiguration && !loaded.formConfiguration.interaction;

    if ( !needValues && !needConfig ) {
      return loaded;
    }

    // Surface the shared Interaction block on every sketch that doesn't declare
    // its own: seed `sketch.interaction` (so the channel sampler can read
    // hands / audio / orbit / … live) AND add the classic Interaction settings
    // panel to the form. Loaded lazily so a plugin-off build never pulls it in.
    // Each sketch gets its own clone of the values so runtime edits never leak
    // across sketches; the config is static and shared. Sketches that declare
    // their own `interaction` (e.g. interaction-test) are left untouched.
    //
    // `loaded` is the dynamic-import module namespace — its exports are
    // read-only getters, so we build a fresh meta object rather than assigning
    // onto it (assigning throws, which the catch below would turn into a sketch
    // with no form at all).
    const {
      interactionFormValues, interactionFormConfiguration
    } = await import( "@/p5/utils/interaction/defaults.js" );

    // The canonical defaults ship "live" (enabled + orbit on) for the sketches
    // that import them deliberately, but a seeded sketch has no bindings yet —
    // an active block would boot the interaction handler and run the orbit
    // virtual pointer on every non-interactive sketch. Seed it INERT instead;
    // picking an input source on a binding flips `enabled` (and the source's
    // own flag) back on — see interactionEnablePaths / enableSourceInputs in
    // the BindingAffordance.
    const seededInteraction = structuredClone( interactionFormValues );

    seededInteraction.enabled = false;
    seededInteraction.orbit.enabled = false;

    return {
      formValues: needValues
        ? {
          ...loaded.formValues,
          interaction: seededInteraction
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
