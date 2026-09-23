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
  BUILTIN_SOURCES,
  POINT_BUILTIN_SOURCES,
  flattenKeys,
  flattenPointKeys,
  groupKeyPaths,
  isProbeSource,
  probeSourceId,
  probeSourceName
} from "@/p5/utils/hud/keyPaths";
import {
  useLiveProbes, type LiveProbe
} from "@/hooks/useLiveProbes";

type Props = {
  name: string;
  label?: string;
  /**
   * The value shape the consuming widget can act on. "point" narrows the list
   * to the `{ x, y }` key-paths and the point built-ins; anything else lists
   * the scalars, as before.
   */
  kind?: "scalar" | "point";
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

/** How a live probe reads in the picker: its label or name, plus its unit. */
function probeOptionLabel( probe: LiveProbe ): string {
  const base = probe.label ?? probe.name;

  return probe.unit ? `${ base } (${ probe.unit })` : base;
}

/**
 * Source picker for HUD widgets. Populated — like the `specs` overlay — by
 * enumerating the keys that already exist in the sketch settings, plus the
 * built-in live sources: the form already holds the sketch settings, so that
 * key list is derived client-side. The third family, the probes the running
 * sketch exposes from inside its draw, cannot be — it is read off the probe
 * bridge, and re-rendered only when a probe appears or disappears.
 *
 * Shares the segmented control-bar chrome: a label segment, the selected value,
 * and an invisible native <select> overlaying the whole bar.
 */
export default function ControlledSourceSelect( {
  name,
  label,
  kind = "scalar",
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

  const isPointPicker = kind === "point";
  const builtins = isPointPicker ? POINT_BUILTIN_SOURCES : BUILTIN_SOURCES;
  const keys = isPointPicker
    ? flattenPointKeys( sketch ?? {} )
    : flattenKeys( sketch ?? {} );
  const {
    rootOptions, groups
  } = groupKeyPaths( keys );

  // A picker offers what its consumer can read: the point pickers list the
  // point-shaped probes, the scalar pickers everything else.
  const liveProbes = useLiveProbes().filter( ( probe ) =>
    ( probe.shape === "point" ) === isPointPicker );
  const currentValue = typeof field.value === "string" ? field.value : "";
  const builtin = builtins.find( ( source ) => source.value === currentValue );
  const currentProbe = isProbeSource( currentValue )
    ? liveProbes.find( ( probe ) => probeSourceId( probe.name ) === currentValue )
    : undefined;
  // A saved probe source is only listed while the sketch writes it — after a
  // reload, or while its branch is not running, it is gone. Keep it selectable
  // rather than letting the native select show the first entry over the saved
  // value, and say that nothing is arriving.
  const missingProbe = isProbeSource( currentValue ) && !currentProbe;
  const displayLabel = builtin?.label
    ?? ( currentProbe ? probeOptionLabel( currentProbe ) : null )
    ?? ( missingProbe ? `${ probeSourceName( currentValue ) } (not arriving)` : null )
    ?? ( currentValue || "—" );

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
          {builtins.map( ( source ) => (
            <option key={ source.value } value={ source.value }>
              {source.label}
            </option>
          ) )}
        </optgroup>

        {( liveProbes.length > 0 || missingProbe ) && (
          <optgroup label="Probes (live)">
            {liveProbes.map( ( probe ) => (
              <option key={ probe.name } value={ probeSourceId( probe.name ) }>
                {probeOptionLabel( probe )}
              </option>
            ) )}
            {missingProbe && (
              <option value={ currentValue }>
                {probeSourceName( currentValue )} (not arriving)
              </option>
            )}
          </optgroup>
        )}

        {/* Keep a saved key selectable even if it isn't in the current list. */}
        {currentValue && !builtin && !isProbeSource( currentValue ) && !keys.includes( currentValue ) && (
          <option value={ currentValue } hidden>
            {currentValue}
          </option>
        )}

        {rootOptions.length > 0 && (
          <optgroup label={ isPointPicker ? "Sketch vectors" : "Sketch parameters" }>
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
