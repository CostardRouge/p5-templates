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
  collectBranchPaths, flattenKeys, groupKeyPaths
} from "@/p5/utils/hud/keyPaths";

type Props = {
  name: string;
  label?: string;
  placeholder?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

/**
 * Parameter-key picker for the breakdown's `snapKeys` / `excludeKeys` lists.
 * Same derivation as `ControlledSourceSelect` — the key-paths that exist in the
 * sketch settings the form already holds — with two differences: no live
 * built-in sources (a key list addresses sketch parameters only), and **whole
 * groups are selectable**. Picking "colors" covers every leaf under it;
 * `matchesKeyList` (src/sketches/p5/utils/slides/keyMatch.js) applies the
 * ancestor rule at runtime.
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

  const keys = flattenKeys( sketch ?? {} );
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
