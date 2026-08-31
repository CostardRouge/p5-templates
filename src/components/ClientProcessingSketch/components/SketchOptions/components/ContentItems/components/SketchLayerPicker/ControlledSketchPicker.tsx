"use client";

import React from "react";
import clsx from "clsx";
import {
  Blocks, Loader2
} from "lucide-react";
import {
  useFormContext, useWatch
} from "react-hook-form";

import SketchPickerDialog from "./SketchPickerDialog";
import {
  findEmbeddableSketch, loadSketchForm, type SketchChoice
} from "@/lib/sketchLayerCatalogue";

type ControlledSketchPickerProps = {
  /** Form path of the layer's `sketch` field. */
  name: string;
  /** Form path of the layer itself, e.g. `content.2`. */
  itemPath: string;
  label?: string;
};

/**
 * The "which sketch does this layer run" control: a thumbnail tile that opens
 * the catalogue picker.
 *
 * Picking writes TWO fields, and that pairing is the whole point of doing this
 * in one control: the layer's `sketch` path, and its `settings` reset to the
 * newly chosen sketch's own defaults. Every sketch declares a different
 * parameter shape, so carrying the previous layer's settings across a change
 * would leave the new sketch reading keys that mean nothing to it — a form full
 * of controls bound to values the running sketch ignores.
 */
export default function ControlledSketchPicker( {
  name,
  itemPath,
  label
}: ControlledSketchPickerProps ) {
  const {
    control, setValue
  } = useFormContext();

  const path = useWatch( {
    control,
    name
  } ) as string | undefined;

  const [
    open,
    setOpen
  ] = React.useState( false );
  const [
    loading,
    setLoading
  ] = React.useState( false );

  const choice = findEmbeddableSketch( path );

  const handlePick = React.useCallback(
    ( picked: SketchChoice ) => {
      setOpen( false );

      if ( picked.path === path ) {
        return;
      }

      setLoading( true );

      loadSketchForm( picked.path )
        .then( ( form ) => {
          setValue(
            `${ itemPath }.settings`,
            form.formValues,
            {
              shouldDirty: true,
              shouldTouch: true
            }
          );
        } )
        .catch( () => {
          // The layer is still usable with an empty settings object: the
          // embedded sketch then runs on whatever its own code defaults to.
          setValue(
            `${ itemPath }.settings`,
            {},
            {
              shouldDirty: true
            }
          );
        } )
        .finally( () => {
          setValue(
            name,
            picked.path,
            {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true
            }
          );
          setLoading( false );
        } );
    },
    [
      itemPath,
      name,
      path,
      setValue
    ]
  );

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-label">{label}</span>
      )}

      <button
        type="button"
        onClick={ () => setOpen( true ) }
        className={ clsx(
          "flex items-center gap-2 rounded-lg border border-theme bg-background p-1.5 text-left",
          "transition hover:bg-hover hover:border-foreground/20"
        ) }
      >
        {choice ? (
          <img
            src={ choice.thumbnail }
            alt=""
            className="h-10 w-8 shrink-0 rounded bg-hover object-cover"
          />
        ) : (
          <span className="flex h-10 w-8 shrink-0 items-center justify-center rounded bg-hover text-label">
            <Blocks className="h-4 w-4" strokeWidth={ 1.75 } />
          </span>
        )}

        <span className="flex min-w-0 flex-col">
          <span className="truncate text-foreground">
            {choice?.name ?? path ?? "Choose a sketch…"}
          </span>
          {choice?.category && (
            <span className="truncate text-label/70">{choice.category}</span>
          )}
        </span>

        {loading && (
          <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-label" />
        )}
      </button>

      <SketchPickerDialog
        open={ open }
        value={ path }
        onPick={ handlePick }
        onClose={ () => setOpen( false ) }
      />
    </div>
  );
}
