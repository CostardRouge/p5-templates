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
import parseFormat from "./utils/parseFormat";
import {
  SelectOption
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  CONTROL_BAR_CLASS,
  CONTROL_CHEVRON_CLASS
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/control-bar";
import {
  BarLabelSegment
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlChrome";
import usePresentationMode from "@/hooks/usePresentationMode";

type Props = {
  id: string;
  label?: string;
  noneLabel?: string;
  options: SelectOption[];
  sizeFieldPrefix?: string;
};

export default function ControlledFormatSelect( {
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

  // While the canvas is stretched, the presentation controller owns the size:
  // it writes the surface's dimensions into the form and restores the sketch's
  // own on exit. Offering a preset here would be a control fighting a live
  // driver, so the select reads out the effective size instead.
  const {
    stretchCanvas
  } = usePresentationMode();

  const currentValue = width && height ? `${ width }x${ height }` : "";
  const {
    ungrouped, groups
  } = useMemo(
    () => {
      const ungrouped: SelectOption[] = [];
      const groups = new Map<string, SelectOption[]>();

      for ( const option of options ) {
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

    const parsedFormat = parseFormat( value );

    if ( !parsedFormat ) {
      return;
    }

    const {
      width, height
    } = parsedFormat;

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

  if ( stretchCanvas ) {
    return (
      <div className={ `${ CONTROL_BAR_CLASS } opacity-60` }>
        <BarLabelSegment label={ label } />

        <span
          className="flex min-w-0 flex-1 items-center gap-1 px-2.5"
          title="The canvas is following the available surface. Turn off “Stretch canvas” to pick a size again."
        >
          <span className="truncate">
            {currentValue ? `Adaptive — ${ width } × ${ height }` : "Adaptive"}
          </span>
        </span>
      </div>
    );
  }

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

        {/* Keep the native select consistent when the current size matches
            no preset. */}
        {currentValue && !matchedOption && (
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
