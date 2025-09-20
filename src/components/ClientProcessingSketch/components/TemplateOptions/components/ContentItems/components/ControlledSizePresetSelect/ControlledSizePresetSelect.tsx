"use client";

import React, {
  useMemo
} from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";
import parseSizePreset from "./utils/parsePreset";
import {
  SelectOption
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

type Props = {
  id: string;
  className?: string;
  noneLabel?: string;
  options: SelectOption[];
};

export default function ControlledSizePresetSelect( {
  id,
  className = "",
  noneLabel,
  options,
}: Props ) {
  const {
    control, setValue
  } = useFormContext();

  // Keep the select in sync with current size in the form
  const width = useWatch( {
    control,
    name: "size.width"
  } ) as number | undefined;
  const height = useWatch( {
    control,
    name: "size.height"
  } ) as number | undefined;
  const currentValue = width && height ? `${ width }x${ height }` : "";

  const {
    ungrouped, groups
  } = useMemo(
    () => {
      const ungrouped: SelectOption[] = [
      ];
      const groups = new Map<string, SelectOption[]>();

      for ( const option of options ) {
        if ( option.group ) {
          if ( !groups.has( option.group ) ) groups.set(
            option.group,
            [
            ]
          );

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

    const parsedSizePreset = parseSizePreset( value );

    if ( !parsedSizePreset ) {
      return;
    }

    const {
      width, height
    } = parsedSizePreset;

    setValue(
      "size.width",
      width,
      {
        shouldDirty: true,
        shouldValidate: true
      }
    );
    setValue(
      "size.height",
      height,
      {
        shouldDirty: true,
        shouldValidate: true
      }
    );
  };

  return (
    <select
      id={id}
      className={`w-full border border-gray-300 rounded-sm ${ className }`}
      value={currentValue}
      onChange={handleChange}
    >
      {noneLabel ? <option value="">{noneLabel}</option> : null}

      {/* Ungrouped options first */}
      {ungrouped.map( ( opt ) => (
        <option key={String( opt.value )} value={String( opt.value )}>
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
        <optgroup key={groupLabel} label={groupLabel}>
          {opts.map( ( opt ) => (
            <option key={String( opt.value )} value={String( opt.value )}>
              {opt.label}
            </option>
          ) )}
        </optgroup>
      ) )}
    </select>
  );
}
