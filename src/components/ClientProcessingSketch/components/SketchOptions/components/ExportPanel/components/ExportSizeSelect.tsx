"use client";

import React, {
  useMemo, useState
} from "react";
import {
  ChevronDown, Ruler
} from "lucide-react";
import {
  formatOptions
} from "../../RootSettings/constants/root-field-config";
import parseFormat from "../../ContentItems/components/ControlledFormatSelect/utils/parseFormat";
import {
  isFullscreenFormatValue
} from "@/lib/fullscreen/constants";
import type {
  ExportSize, ExportSizeStrategy
} from "@/lib/export/variants";

const NATIVE = "native";
const CUSTOM = "custom";

type ExportSizeSelectProps = {
  /** `null` = follow the sketch's own (per-slide) size. */
  value: ExportSize | null;
  onChange: ( size: ExportSize | null ) => void;
  disabled?: boolean;
  /** Shown as the "sketch's own size" resolved value, for context. */
  nativeSize: ExportSize;
  /** True when the slides this variant covers disagree on canvas size. */
  mixedSizes?: boolean;
  sizeStrategy: ExportSizeStrategy;
  onStrategyChange: ( strategy: ExportSizeStrategy ) => void;
};

/**
 * The canvas-size picker for one export variant.
 *
 * Deliberately fed by the sketch form's own `formatOptions` rather than a list
 * of its own: the resolutions an export offers are the resolutions the studio
 * offers, and a second hand-maintained table would drift the first time
 * someone adds a preset.
 *
 * Two entries are filtered out or added on top of that list:
 *   - **fullscreen sentinels are dropped** — they are not a W×H at all, they
 *     drive the browser Fullscreen API, which is meaningless as an export
 *     target;
 *   - **Custom…** swaps the control for a width/height pair, because a size
 *     worth exporting is not always a size worth adding to the preset list.
 */
export default function ExportSizeSelect( {
  value,
  onChange,
  disabled = false,
  nativeSize,
  mixedSizes = false,
  sizeStrategy,
  onStrategyChange
}: ExportSizeSelectProps ) {
  const presets = useMemo(
    () => formatOptions.filter( ( option ) => !isFullscreenFormatValue( option.value ) ),
    []
  );

  const currentValue = value
    ? `${ value.width }x${ value.height }`
    : mixedSizes ? `${ NATIVE }:${ sizeStrategy }` : NATIVE;
  const matchesPreset = presets.some( ( option ) => option.value === currentValue );

  // Custom stays open while the user types, even if the numbers momentarily
  // land on a preset — closing the inputs mid-edit would be hostile.
  const [
    custom,
    setCustom
  ] = useState( false );
  const showCustom = custom || Boolean( value && !matchesPreset );

  const groups = useMemo(
    () => {
      const ordered: Array<{
        name: string;
        options: typeof presets;
      }> = [];

      for ( const option of presets ) {
        const name = option.group ?? "Other";
        const existing = ordered.find( ( entry ) => entry.name === name );

        if ( existing ) {
          existing.options.push( option );
        } else {
          ordered.push( {
            name,
            options: [
              option
            ]
          } );
        }
      }

      return ordered;
    },
    [
      presets
    ]
  );

  if ( showCustom ) {
    const size = value ?? nativeSize;

    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={ 50 }
          max={ 8192 }
          disabled={ disabled }
          value={ size.width }
          aria-label="Export width"
          onChange={ ( event ) => onChange( {
            width: Number( event.target.value ) || 1,
            height: size.height
          } ) }
          className="w-14 rounded-md border border-theme bg-background px-1.5 py-1 text-center font-mono text-[11px] tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
        />
        <span className="text-[10px] text-label">×</span>
        <input
          type="number"
          min={ 50 }
          max={ 8192 }
          disabled={ disabled }
          value={ size.height }
          aria-label="Export height"
          onChange={ ( event ) => onChange( {
            width: size.width,
            height: Number( event.target.value ) || 1
          } ) }
          className="w-14 rounded-md border border-theme bg-background px-1.5 py-1 text-center font-mono text-[11px] tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
        />
        <button
          type="button"
          disabled={ disabled }
          onClick={ () => {
            setCustom( false );
            onChange( null );
          } }
          title="Back to the size presets"
          aria-label="Back to the size presets"
          className="rounded-md p-1 text-label transition-colors hover:bg-hover hover:text-foreground disabled:opacity-50"
        >
          <Ruler className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={ currentValue }
        disabled={ disabled }
        aria-label="Export canvas size"
        onChange={ ( event ) => {
          const next = event.target.value;

          if ( next === CUSTOM ) {
            setCustom( true );
            onChange( value ?? nativeSize );

            return;
          }

          if ( next.startsWith( NATIVE ) ) {
            const strategy = next.split( ":" )[ 1 ] as ExportSizeStrategy | undefined;

            if ( strategy ) {
              onStrategyChange( strategy );
            }

            onChange( null );

            return;
          }

          onChange( parseFormat( next ) );
        } }
        className="w-full cursor-pointer appearance-none rounded-md border border-transparent bg-transparent py-1 pl-1 pr-5 font-mono text-[11px] tabular-nums text-foreground transition-colors hover:border-theme focus:border-theme focus:outline-none disabled:opacity-50"
      >
        {mixedSizes ? (
          <optgroup label="Sketch's own — slides differ">
            <option value={ `${ NATIVE }:smallest` }>Smallest slide</option>
            <option value={ `${ NATIVE }:biggest` }>Biggest slide</option>
            <option value={ `${ NATIVE }:root` }>Root canvas</option>
          </optgroup>
        ) : (
          <option value={ NATIVE }>
            Sketch&apos;s own ({nativeSize.width}×{nativeSize.height})
          </option>
        )}
        {groups.map( ( group ) => (
          <optgroup key={ group.name } label={ group.name }>
            {group.options.map( ( option ) => (
              <option key={ String( option.value ) } value={ String( option.value ) }>
                {option.label}
              </option>
            ) )}
          </optgroup>
        ) )}
        <option value={ CUSTOM }>Custom…</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-label" />
    </div>
  );
}
