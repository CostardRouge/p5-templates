"use client";

import React from "react";
import {
  Shuffle
} from "lucide-react";
import {
  useFormContext
} from "react-hook-form";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  randomizeFields
} from "@/components/ClientProcessingSketch/components/SketchOptions/utils/randomizeFields";

type RandomizeSettingsButtonProps = {
  config: Record<string, FieldConfig>;
  basePath: string;
  className?: string;
};

/**
 * Randomizes every field of a form config at once — the inspector's action bar
 * (whole sketch) and each nested-object group header (that group). A single
 * field's own button is {@link RandomizeFieldButton}; both walk the same
 * `randomizeFields`, so a newly randomizable component kind lands in both.
 */
export default function RandomizeSettingsButton( {
  config,
  basePath,
  className = "text-foreground hover:bg-theme/20 rounded transition-colors"
}: RandomizeSettingsButtonProps ) {
  const {
    getValues, setValue
  } = useFormContext();

  const handleRandomize = ( event: React.MouseEvent ) => {
    event.stopPropagation();
    randomizeFields(
      config,
      basePath,
      {
        getValues,
        setValue
      }
    );
  };

  return (
    <button
      onClick={ handleRandomize }
      className={ className }
      title="Randomize parameters"
    >
      <Shuffle className="w-3.5 h-3.5" />
    </button>
  );
}
