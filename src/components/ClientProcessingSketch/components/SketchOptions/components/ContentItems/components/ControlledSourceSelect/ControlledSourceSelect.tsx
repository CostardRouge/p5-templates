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
  BUILTIN_SOURCES, flattenKeys, groupKeyPaths
} from "@/p5/utils/hud/keyPaths";

type Props = {
  name: string;
  label?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

/**
 * Source picker for HUD widgets. Populated — like the `specs` overlay — by
 * enumerating the keys that already exist in the sketch settings, plus the
 * built-in live sources. No probe registry / runtime bridge required: the form
 * already holds the sketch settings, so the key list is derived client-side.
 *
 * Shares the segmented control-bar chrome: a label segment, the selected value,
 * and an invisible native <select> overlaying the whole bar.
 */
export default function ControlledSourceSelect( {
  name,
  label,
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
  const {
    rootOptions, groups
  } = groupKeyPaths( keys );
  const currentValue = typeof field.value === "string" ? field.value : "";
  const builtin = BUILTIN_SOURCES.find( ( source ) => source.value === currentValue );
  const displayLabel = builtin?.label ?? ( currentValue || "—" );

  return (
    <div className={ CONTROL_BAR_CLASS }>
      <BarLabelSegment
        label={ label }
        isModified={ isModified }
        onReset={ onReset }
      />

      <span className="pointer-events-none flex min-w-0 flex-1 items-center justify-between gap-1 px-2.5">
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
      </span>

      <select
        id={ name }
        aria-label={ label ?? "Source" }
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={ currentValue }
        onChange={ ( e ) => field.onChange( e.target.value ) }
        onBlur={ field.onBlur }
      >
        <optgroup label="Live / built-in">
          {BUILTIN_SOURCES.map( ( source ) => (
            <option key={ source.value } value={ source.value }>
              {source.label}
            </option>
          ) )}
        </optgroup>

        {/* Keep a saved key selectable even if it isn't in the current list. */}
        {currentValue && !builtin && !keys.includes( currentValue ) && (
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
