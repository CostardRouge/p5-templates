"use client";

import React, {
  useMemo
} from "react";
import {
  ChevronDown
} from "lucide-react";
import {
  useFormContext, useWatch
} from "react-hook-form";
import parseSizePreset from "./utils/parsePreset";
import {
  SelectOption
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import {
  CONTROL_BAR_CLASS,
  CONTROL_CHEVRON_CLASS
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/control-bar";
import {
  BarLabelSegment
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlChrome";
import useMediaQuery from "@/hooks/useMediaQuery";
import useFullscreenViewport from "@/hooks/useFullscreenViewport";
import {
  enterViewportFullscreen
} from "@/lib/fullscreen/fullscreenViewport";
import {
  FULLSCREEN_PRESETS,
  fullscreenModeForValue,
  fullscreenValueForMode,
  isFullscreenPresetValue
} from "@/lib/fullscreen/constants";

type Props = {
  id: string;
  label?: string;
  noneLabel?: string;
  options: SelectOption[];
  sizeFieldPrefix?: string;
};

export default function ControlledSizePresetSelect( {
  id,
  label,
  noneLabel,
  options,
  sizeFieldPrefix = ""
}: Props ) {
  const {
    control, setValue
  } = useFormContext();

  const widthField = `${ sizeFieldPrefix }size.width` as const;
  const heightField = `${ sizeFieldPrefix }size.height` as const;

  // Keep the select in sync with the current size in the form
  const width = useWatch( {
    control,
    name: widthField
  } ) as number | undefined;
  const height = useWatch( {
    control,
    name: heightField
  } ) as number | undefined;

  // Fullscreen is a desktop-only affordance driven by the browser Fullscreen
  // API. Only surface it where the size config actually carries the sentinel
  // options (the global canvas size), the viewport is wide, and the browser
  // permits it.
  const hasFullscreenOption = options.some( ( option ) => isFullscreenPresetValue( option.value ) );
  const isDesktop = useMediaQuery( "(min-width: 768px)" );
  const {
    isFullscreen, mode, isSupported
  } = useFullscreenViewport();
  const fullscreenAvailable = hasFullscreenOption && isDesktop && isSupported;
  const fullscreenActive = fullscreenAvailable && isFullscreen;

  const currentValue = fullscreenActive
    ? fullscreenValueForMode( mode ) ?? FULLSCREEN_PRESETS[ 0 ].value
    : width && height
      ? `${ width }x${ height }`
      : "";

  // The fullscreen sentinels are rendered on their own (below); keep them out of
  // the W×H preset groups so they never land among the size options.
  const {
    ungrouped, groups
  } = useMemo(
    () => {
      const ungrouped: SelectOption[] = [];
      const groups = new Map<string, SelectOption[]>();

      for ( const option of options ) {
        if ( isFullscreenPresetValue( option.value ) ) {
          continue;
        }

        if ( option.group ) {
          if ( !groups.has( option.group ) ) {
            groups.set(
              option.group,
              []
            );
          }

          groups.get( option.group )!.push( option );
        } else {
          ungrouped.push( option );
        }
      }
      return {
        ungrouped,
        groups
      };
    },
    [
      options
    ]
  );

  const handleChange: React.ChangeEventHandler<HTMLSelectElement> = ( e ) => {
    const value = String( e.target.value );

    if ( !value ) {
      return;
    } // keep current size if user picked placeholder

    const fullscreenMode = fullscreenModeForValue( value );

    if ( fullscreenMode ) {
      // Issued synchronously inside this change handler so the user gesture
      // still authorises the Fullscreen request.
      void enterViewportFullscreen( fullscreenMode );
      return;
    }

    const parsedSizePreset = parseSizePreset( value );

    if ( !parsedSizePreset ) {
      return;
    }

    const {
      width, height
    } = parsedSizePreset;

    setValue(
      widthField,
      width,
      {
        shouldDirty: true,
        shouldValidate: true
      }
    );
    setValue(
      heightField,
      height,
      {
        shouldDirty: true,
        shouldValidate: true
      }
    );
  };

  const matchedOption = options.find( ( option ) => String( option.value ) === currentValue );
  // A size set by hand may match no preset: surface it as "W × H".
  const displayLabel =
    matchedOption?.label ??
    ( currentValue ? `${ width } × ${ height }` : ( noneLabel ?? "--" ) );

  return (
    <div className={ CONTROL_BAR_CLASS }>
      <BarLabelSegment label={ label } />

      <span className="pointer-events-none flex min-w-0 flex-1 items-center justify-between gap-1 px-2.5">
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
      </span>

      <select
        id={ id }
        aria-label={ label ?? "Size preset" }
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={ currentValue }
        onChange={ handleChange }
      >
        {noneLabel ? <option value="">{noneLabel}</option> : null}

        {/* Fullscreen modes — desktop only, and only when the browser allows it. */}
        {fullscreenAvailable &&
          FULLSCREEN_PRESETS.map( ( preset ) => (
            <option key={ preset.value } value={ preset.value }>
              {preset.label}
            </option>
          ) )}

        {/* Keep the native select consistent when the current size matches
            no preset. */}
        {currentValue && !isFullscreenPresetValue( currentValue ) && !matchedOption && (
          <option value={ currentValue } hidden>
            {displayLabel}
          </option>
        )}

        {/* Ungrouped options first */}
        {ungrouped.map( ( opt ) => (
          <option key={ String( opt.value ) } value={ String( opt.value ) }>
            {opt.label}
          </option>
        ) )}

        {/* Then grouped options as <optgroup> */}
        {[
          ...groups.entries()
        ].map( ( [
          groupLabel,
          opts
        ] ) => (
          <optgroup key={ groupLabel } label={ groupLabel }>
            {opts.map( ( opt ) => (
              <option key={ String( opt.value ) } value={ String( opt.value ) }>
                {opt.label}
              </option>
            ) )}
          </optgroup>
        ) )}
      </select>
    </div>
  );
}
