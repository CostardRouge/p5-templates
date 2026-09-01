"use client";

import React from "react";
import {
  ChevronDown
} from "lucide-react";
import {
  useController, useFormContext, useWatch
} from "react-hook-form";
import {
  CONTROL_BAR_CLASS, CONTROL_CHEVRON_CLASS
} from "../../constants/control-bar";
import {
  BarLabelSegment
} from "../ControlChrome";
import {
  collectBranchPaths, groupKeyPaths
} from "@/p5/utils/hud/keyPaths";
import {
  collectAnimatableKeyPaths
} from "@/p5/utils/slides/breakdown/deriveSteps";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

type Props = {
  name: string;
  label?: string;
  placeholder?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

/**
 * Parameter-key picker for the breakdown's `snapKeys` / `excludeKeys` lists.
 * The options are the key-paths of the sketch settings the form holds, minus
 * the live built-in sources of `ControlledSourceSelect` (a key list addresses
 * sketch parameters only) and plus a **whole groups** optgroup: picking
 * "colors" covers every leaf under it, `matchesKeyList`
 * (src/sketches/p5/utils/slides/keyMatch.js) applying the ancestor rule at
 * runtime.
 *
 * The paths come from `collectAnimatableKeyPaths` — the breakdown's OWN walk —
 * not from the HUD's `flattenKeys`, so the list is exactly the set of keys the
 * runtime can act on: colours and vectors (numeric arrays) are offered, a
 * sketch parameter named `title` is offered, and the `interaction` / `bindings`
 * blocks the derivation skips are not (they alone were 130 dead options on the
 * hand-capture sketches, burying the sketch's own parameters).
 */
export default function ControlledKeySelect( {
  name,
  label,
  placeholder,
  isModified,
  onReset
}: Props ) {
  const {
    control
  } = useFormContext();
  const {
    field
  } = useController( {
    name,
    control
  } );

  const sketch = useWatch( {
    control,
    name: "sketch"
  } );

  // The root sketch settings, not the active slide's: the shape is the same
  // and the root is the defaults holder. It is empty only before the form has
  // any sketch block at all — the sketch's stock defaults describe the same
  // tree, so the picker still lists the real parameters rather than nothing.
  const [
    {
      sketchFormValues
    }
  ] = useSketch();

  const settings =
    sketch && Object.keys( sketch ).length > 0 ? sketch : sketchFormValues;

  const keys = collectAnimatableKeyPaths( settings ?? {} );
  const branches = collectBranchPaths( keys );
  const {
    rootOptions, groups
  } = groupKeyPaths( keys );

  const currentValue = typeof field.value === "string" ? field.value : "";
  const isKnown =
    currentValue !== "" &&
    ( keys.includes( currentValue ) || branches.includes( currentValue ) );
  const emptyLabel = placeholder ?? "Pick a key…";

  return (
    <div className={ CONTROL_BAR_CLASS }>
      <BarLabelSegment
        label={ label }
        isModified={ isModified }
        onReset={ onReset }
      />

      <span className="pointer-events-none flex min-w-0 flex-1 items-center justify-between gap-1 px-2.5">
        <span className="truncate">{currentValue || emptyLabel}</span>
        <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
      </span>

      <select
        id={ name }
        aria-label={ label ?? "Key" }
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={ currentValue }
        onChange={ ( e ) => field.onChange( e.target.value ) }
        onBlur={ field.onBlur }
      >
        <option value="">{emptyLabel}</option>

        {/* A key typed before the picker existed — or one whose parameter the
            current sketch settings no longer carry — stays selected. */}
        {currentValue && !isKnown && (
          <option value={ currentValue } hidden>
            {currentValue}
          </option>
        )}

        {rootOptions.length > 0 && (
          <optgroup label="Sketch parameters">
            {rootOptions.map( ( option ) => (
              <option key={ option.value } value={ option.value }>
                {option.label}
              </option>
            ) )}
          </optgroup>
        )}

        {branches.length > 0 && (
          <optgroup label="Whole groups">
            {branches.map( ( branch ) => (
              <option key={ branch } value={ branch }>
                {branch}
              </option>
            ) )}
          </optgroup>
        )}

        {groups.map( ( group ) => (
          <optgroup key={ group.label } label={ group.label }>
            {group.options.map( ( option ) => (
              <option key={ option.value } value={ option.value }>
                {option.label}
              </option>
            ) )}
          </optgroup>
        ) )}
      </select>
    </div>
  );
}
