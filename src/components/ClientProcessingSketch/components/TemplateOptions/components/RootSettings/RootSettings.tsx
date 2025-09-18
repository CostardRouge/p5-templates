"use client";

import React from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";
import {
  SketchOption
} from "@/types/sketch.types";
import {
  rootFormConfig, sizePresetOptions
} from "./constants/root-field-config";

import GenericObjectForm from "./components/GenericObjectForm/GenericObjectForm";

import parseSizePreset from "@/components/ClientProcessingSketch/components/TemplateOptions/components/RootSettings/utils/parsePreset";

export default function RootSettings() {
  const {
    control, setValue
  } = useFormContext<SketchOption>();

  // Watch what we need to sync
  const size = useWatch( {
    control,
    name: "size"
  } ) as SketchOption["size"] | undefined;
  const animation = useWatch( {
    control,
    name: "animation"
  } ) as SketchOption["animation"] | undefined;

  // Also watch the virtual "sizePreset" field we render via config
  const sizePreset = useWatch( {
    control,
    name: "sizePreset"
  } ) as string | undefined;

  // When the user picks a size preset, map it to size.width/height
  React.useEffect(
    () => {
      if ( !sizePreset ) {
        return;
      }

      const parsed = parseSizePreset( sizePreset );

      if ( parsed ) {
        setValue(
          "size.width",
          parsed.w,
          {
            shouldDirty: true,
            shouldValidate: true
          }
        );
        setValue(
          "size.height",
          parsed.h,
          {
            shouldDirty: true,
            shouldValidate: true
          }
        );
      }
    },
    [
      sizePreset,
      setValue
    ]
  );

  // Keep the select value in sync if size is changed elsewhere (e.g., programmatically)
  // Pick the first matching option, or leave as-is if none match.
  React.useEffect(
    () => {
      if ( !size?.width || !size?.height ) return;
      const key = `${ size.width }x${ size.height }`;
      const exists = sizePresetOptions.some( ( o ) => o.value === key );

      if ( exists ) {
        setValue(
          "sizePreset",
          key,
          {
            shouldDirty: false,
            shouldValidate: false
          }
        );
      } else {
      // You can optionally clear or keep a custom value; we leave it untouched.
      }
    },
    [
      size?.width,
      size?.height,
      setValue
    ]
  );

  return (
    <div className="p-1 border rounded-sm bg-white hover:shadow hover:border-gray-300 text-black">
      {/* <div className="text-xs text-gray-500">settings</div>*/}

      <GenericObjectForm config={rootFormConfig} />
    </div>
  );
}
