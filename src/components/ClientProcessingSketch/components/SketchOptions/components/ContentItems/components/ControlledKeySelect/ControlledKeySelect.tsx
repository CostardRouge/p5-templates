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

/**
 * The form path of the sketch settings a content-item field belongs to. A
 * content item is addressed either globally ("content.4.…") or through the
 * slide that owns it ("slides.2.content.4.…"), and each slide carries its own
 * `sketch` block — so the item's own path is what says which one the picker
 * must read. `getSketchScope` (bindingUtils) cannot answer this: it maps a
 * field that IS a sketch parameter, and a content item never is.
 */
function sketchScopeForItemField( fieldName: string ): string {
  const slide = /^slides\.(\d+)\./.exec( fieldName );

  return slide ? `slides.${ slide[ 1 ] }.sketch` : "sketch";
}

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
 *
 * They are read from the sketch's stock defaults unioned with the settings of
 * the scope the item lives in, so no stored block — pruned, or predating a
 * parameter the sketch has since gained — can hide a real parameter.
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

  // The sketch-settings scope this item actually animates: a breakdown living
  // in a slide narrates THAT slide's parameters ("slides.2.content.4.…"), a
  // shared one the root block.
  const sketch = useWatch( {
    control,
    name: sketchScopeForItemField( name )
  } );

  // Two sources, unioned, because neither alone is the parameter space:
  // the stock defaults are what the sketch DECLARES (authoritative, complete,
  // and in declaration order), while the form's own block is what this
  // document STORES — which can be pruned or predate a parameter the sketch
  // has since gained. Taking only the stored block is how a real parameter
  // goes missing from the list; taking only the defaults would hide a key a
  // stored tree carries beyond them.
  const [
    {
      sketchFormValues
    }
  ] = useSketch();

  const keys = [
    ...new Set( [
      ...collectAnimatableKeyPaths( sketchFormValues ?? {} ),
      ...collectAnimatableKeyPaths( sketch ?? {} )
    ] )
  ];
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
