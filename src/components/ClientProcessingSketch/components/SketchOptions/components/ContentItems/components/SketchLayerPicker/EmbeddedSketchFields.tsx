"use client";

import React from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";

import GenericObjectForm
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/RootSettings/components/GenericObjectForm/GenericObjectForm";
import {
  findEmbeddableSketch, loadSketchForm, sketchNameFromPath
} from "@/lib/sketchLayerCatalogue";
import type {
  FieldConfig
} from "../../constants/field-config";

type EmbeddedSketchFieldsProps = {
  /** Form path of the layer, e.g. `content.2` or `slides.1.content.0`. */
  itemPath: string;
};

/**
 * The embedded sketch's OWN parameters, inside the layer's inspector.
 *
 * This is what makes a sketch layer worth having: the controls are exactly the
 * ones that sketch offers on its own page — same components, same ranges, same
 * groups — because they are rendered from that sketch's `formConfiguration`,
 * just bound to `<layer>.settings` instead of the page's `sketch` scope.
 *
 * The config cannot be bundled: `options.ts` modules are server-only (some read
 * the filesystem at import time), so it is fetched per sketch and cached for
 * the life of the page — see `@/lib/sketchLayerCatalogue`.
 */
export default function EmbeddedSketchFields( {
  itemPath
}: EmbeddedSketchFieldsProps ) {
  const {
    control, getValues, setValue
  } = useFormContext();

  const sketchPath = useWatch( {
    control,
    name: `${ itemPath }.sketch`
  } ) as string | undefined;

  const [
    state,
    setState
  ] = React.useState<{
    sketch: string | undefined;
    configuration: Record<string, FieldConfig> | null;
    error: string | null;
  }>( {
    sketch: undefined,
    configuration: null,
    error: null
  } );

  React.useEffect(
    () => {
      if ( !sketchPath ) {
        return;
      }

      let cancelled = false;

      loadSketchForm( sketchPath )
        .then( ( form ) => {
          if ( cancelled ) {
            return;
          }

          // A layer restored from a saved options file (or imported JSON) may
          // carry no settings at all — seed the defaults once the shape is
          // known, or every control would render empty and the embedded sketch
          // would run on whatever its code falls back to.
          const current = getValues( `${ itemPath }.settings` );

          if ( !current || Object.keys( current ).length === 0 ) {
            setValue(
              `${ itemPath }.settings`,
              form.formValues,
              {
                shouldDirty: false
              }
            );
          }

          setState( {
            sketch: sketchPath,
            configuration: form.formConfiguration,
            error: null
          } );
        } )
        .catch( ( error: Error ) => {
          if ( !cancelled ) {
            setState( {
              sketch: sketchPath,
              configuration: null,
              error: error.message
            } );
          }
        } );

      return () => {
        cancelled = true;
      };
    },
    [
      sketchPath,
      itemPath,
      getValues,
      setValue
    ]
  );

  if ( !sketchPath ) {
    return (
      <p className="px-1 py-2 text-label/70">
        Pick a sketch to run in this layer.
      </p>
    );
  }

  if ( state.error ) {
    return (
      <p className="px-1 py-2 text-red-500">{state.error}</p>
    );
  }

  // A layer can carry a sketch the picker greys out — one added before the
  // limitation was known, or restored from an imported options file. The rail
  // has to say why the canvas shows nothing; the only other signal is a console
  // warning nobody is looking at.
  const unavailable = findEmbeddableSketch( sketchPath )?.unavailable;

  if ( unavailable ) {
    return (
      <p className="px-1 py-2 text-label/70">{unavailable}.</p>
    );
  }

  // Guard on the sketch the config belongs to, not merely on its presence:
  // between two sketches the previous one's controls would otherwise render for
  // a beat, bound to keys the new settings object does not have.
  if ( !state.configuration || state.sketch !== sketchPath ) {
    return (
      <p className="px-1 py-2 text-label/70">Loading its controls…</p>
    );
  }

  const count = Object.keys( state.configuration ).length;

  if ( count === 0 ) {
    return (
      <p className="px-1 py-2 text-label/70">
        This sketch has no parameters of its own.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {/* A rule plus the same eyebrow the layer groups use: without it the
          embedded sketch's controls run straight on from the layer's own and
          nothing says where one ends and the other begins. It names the sketch
          and counts its options, matching how the inspector titles a sketch's
          parameters on its own page ("N options"). */}
      <div className="flex items-center gap-2 border-t border-theme pb-0.5 pt-2">
        <span className="truncate text-[0.6875rem] uppercase tracking-[0.08em] text-label/70">
          {sketchNameFromPath( sketchPath )}
        </span>
        <span className="text-[0.6875rem] tabular-nums text-label/50">
          {count}
        </span>
      </div>

      {/* Keyed by the sketch: GenericObjectForm's children are bound by path,
          and switching sketches replaces the whole shape under `settings`. */}
      <GenericObjectForm
        key={ sketchPath }
        basePath={ `${ itemPath }.settings` }
        config={ state.configuration }
        leafPaddingClassName="px-0"
      />
    </div>
  );
}
