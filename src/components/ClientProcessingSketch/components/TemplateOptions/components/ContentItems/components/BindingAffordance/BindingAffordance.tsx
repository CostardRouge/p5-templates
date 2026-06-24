"use client";

import React from "react";
import {
  Popover, PopoverButton, PopoverPanel
} from "@headlessui/react";
import {
  Activity, Trash2
} from "lucide-react";
import clsx from "clsx";
import {
  useFormContext, useWatch
} from "react-hook-form";
import type {
  FieldConfig
} from "../../constants/field-config";
import ChannelMeter from "./ChannelMeter";
import {
  type Binding,
  type BindingKind,
  bindingVarName,
  channelSourceOptions,
  CURVE_OPTIONS,
  decodeSource,
  encodeSource,
  getSketchScope,
  makeDefaultBinding,
  toSketchRelativePath
} from "./bindingUtils";

type Props = {
  fieldPath: string;
  component: FieldConfig[ "component" ];
  config: FieldConfig;
};

/**
 * The per-field modulation control. A small pastille sits beside a bindable
 * field (slider / number / vector2d). Bound, it is a live VU meter glowing with
 * the channel's activity; clicking it opens a popover to pick the source,
 * range, curve and smoothing — or to remove the binding.
 *
 * Bindings are stored as data at `<scope>.bindings` (an array on the sketch
 * settings), resolved at read time by the options proxy. This component is the
 * only thing that writes that array for now; the future "Interactive" matrix
 * panel edits the same data.
 */
export default function BindingAffordance( {
  fieldPath,
  component,
  config
}: Props ) {
  const {
    setValue
  } = useFormContext();

  const scope = getSketchScope( fieldPath );
  const target = toSketchRelativePath( fieldPath );
  const bindingsPath = scope ? `${ scope }.bindings` : "";

  const bindings = useWatch( {
    name: bindingsPath || "__no_bindings__"
  } ) as Binding[] | undefined;

  // Not a sketch parameter → no affordance.
  if ( !scope || !target ) {
    return null;
  }

  const kind: BindingKind = component === "vector2d" ? "vector2d" : "continuous";
  const list: Binding[] = Array.isArray( bindings ) ? bindings : [];
  const binding = list.find( ( b ) => b && b.target === target );
  const bound = !!binding;
  const sourceOptions = channelSourceOptions( kind );

  const writeBindings = ( next: Binding[] ) => {
    setValue(
      bindingsPath,
      next,
      {
        shouldDirty: true
      }
    );
  };

  const createBinding = () => {
    const next = makeDefaultBinding(
      target,
      kind,
      sourceOptions[ 0 ],
      config
    );

    writeBindings( [
      ...list,
      next
    ] );
  };

  const updateBinding = ( patch: Partial<Binding> ) => {
    writeBindings( list.map( ( b ) =>
      b.target === target
        ? {
          ...b,
          ...patch
        }
        : b ) );
  };

  const updateMapping = ( patch: Record<string, unknown> ) => {
    updateBinding( {
      mapping: {
        ...( binding?.mapping ?? {} ),
        ...patch
      }
    } );
  };

  const updateAxis = (
    axis: "x" | "y", patch: Record<string, unknown>
  ) => {
    const mapping = binding?.mapping ?? {};

    updateBinding( {
      mapping: {
        ...mapping,
        [ axis ]: {
          ...( mapping[ axis ] ?? {} ),
          ...patch
        }
      }
    } );
  };

  const removeBinding = () => {
    writeBindings( list.filter( ( b ) => b.target !== target ) );
  };

  const varName = binding ? bindingVarName( binding ) : sourceOptions[ 0 ]?.varName;
  const enabled = binding?.enabled !== false;

  return (
    <Popover className="relative shrink-0">
      <PopoverButton
        title={ bound ? "Edit modulation" : "Bind to an interactive input" }
        onClick={ ( e: React.MouseEvent ) => {
          // Creating on first open makes the pastille a one-tap bind.
          if ( !bound ) {
            e.preventDefault();
            createBinding();
          }
        } }
        className={ clsx(
          "relative grid h-7 w-7 place-items-center rounded-md border transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
          bound && enabled
            ? "border-focus/60 text-focus"
            : bound
              ? "border-theme text-label"
              : "border-theme text-label/60 hover:text-foreground hover:bg-hover"
        ) }
      >
        {/* Live VU glow behind the icon, driven purely by the channel CSS var. */}
        {bound && enabled && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-md bg-focus/30"
            style={ {
              opacity: `var(${ varName }, 0)`,
              transform: `scale(calc(0.4 + 0.6 * var(${ varName }, 0)))`
            } }
          />
        )}
        <Activity className="relative h-3.5 w-3.5" />
      </PopoverButton>

      <PopoverPanel
        anchor="bottom end"
        className="z-[60] w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-theme bg-background p-3 text-xs shadow-xl [--anchor-gap:0.4rem] [--anchor-padding:0.5rem]"
      >
        {binding && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Modulation</span>
              <label className="flex items-center gap-1.5 text-label">
                <input
                  type="checkbox"
                  checked={ enabled }
                  onChange={ ( e ) => updateBinding( {
                    enabled: e.target.checked
                  } ) }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                Enabled
              </label>
            </div>

            {/* Source picker + live meter */}
            <div className="flex flex-col gap-1.5">
              <span className="text-label">Source</span>
              <select
                value={ encodeSource(
                  binding.source,
                  binding.project
                ) }
                onChange={ ( e ) => {
                  const {
                    source, project
                  } = decodeSource( e.target.value );

                  updateBinding( {
                    source,
                    project
                  } );
                } }
                className="h-8 w-full rounded-md border border-theme bg-background px-2 text-foreground"
              >
                {sourceOptions.map( ( option ) => (
                  <option key={ option.value } value={ option.value }>
                    {option.label}
                  </option>
                ) )}
              </select>
              <ChannelMeter varName={ varName } />
            </div>

            {/* Range */}
            {kind === "continuous" ? (
              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-label">Min</span>
                  <input
                    type="number"
                    value={ binding.mapping?.min ?? 0 }
                    onChange={ ( e ) => updateMapping( {
                      min: parseFloat( e.target.value )
                    } ) }
                    className="h-8 w-full rounded-md border border-theme bg-background px-2 text-right font-mono text-foreground"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-label">Max</span>
                  <input
                    type="number"
                    value={ binding.mapping?.max ?? 1 }
                    onChange={ ( e ) => updateMapping( {
                      max: parseFloat( e.target.value )
                    } ) }
                    className="h-8 w-full rounded-md border border-theme bg-background px-2 text-right font-mono text-foreground"
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {( [
                  "x",
                  "y"
                ] as const ).map( ( axis ) => (
                  <React.Fragment key={ axis }>
                    <label className="flex flex-col gap-1">
                      <span className="text-label">{axis.toUpperCase()} min</span>
                      <input
                        type="number"
                        value={ binding.mapping?.[ axis ]?.min ?? 0 }
                        onChange={ ( e ) => updateAxis(
                          axis,
                          {
                            min: parseFloat( e.target.value )
                          }
                        ) }
                        className="h-8 w-full rounded-md border border-theme bg-background px-2 text-right font-mono text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-label">{axis.toUpperCase()} max</span>
                      <input
                        type="number"
                        value={ binding.mapping?.[ axis ]?.max ?? 1 }
                        onChange={ ( e ) => updateAxis(
                          axis,
                          {
                            max: parseFloat( e.target.value )
                          }
                        ) }
                        className="h-8 w-full rounded-md border border-theme bg-background px-2 text-right font-mono text-foreground"
                      />
                    </label>
                  </React.Fragment>
                ) )}
              </div>
            )}

            {/* Curve + invert (continuous only) */}
            {kind === "continuous" && (
              <div className="flex items-center gap-2">
                <select
                  value={ binding.mapping?.curve ?? "linear" }
                  onChange={ ( e ) => updateMapping( {
                    curve: e.target.value
                  } ) }
                  className="h-8 flex-1 rounded-md border border-theme bg-background px-2 text-foreground"
                >
                  {CURVE_OPTIONS.map( ( option ) => (
                    <option key={ option.value } value={ option.value }>
                      {option.label}
                    </option>
                  ) )}
                </select>
                <label className="flex items-center gap-1.5 text-label">
                  <input
                    type="checkbox"
                    checked={ !!binding.mapping?.invert }
                    onChange={ ( e ) => updateMapping( {
                      invert: e.target.checked
                    } ) }
                    className="h-3.5 w-3.5 accent-foreground"
                  />
                  Invert
                </label>
              </div>
            )}

            {/* Smoothing */}
            <label className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-label">
                <span>Smoothing</span>
                <span className="font-mono">{( binding.smoothing ?? 0 ).toFixed( 2 )}</span>
              </span>
              <input
                type="range"
                min={ 0 }
                max={ 0.95 }
                step={ 0.05 }
                value={ binding.smoothing ?? 0 }
                onChange={ ( e ) => updateBinding( {
                  smoothing: parseFloat( e.target.value )
                } ) }
                className="w-full accent-foreground"
              />
            </label>

            <button
              type="button"
              onClick={ removeBinding }
              className="flex items-center justify-center gap-1.5 rounded-md border border-theme px-2 py-1.5 text-label transition-colors hover:bg-hover hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove binding
            </button>
          </div>
        )}
      </PopoverPanel>
    </Popover>
  );
}
