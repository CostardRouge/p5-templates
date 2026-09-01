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
  randomizeField
} from "@/components/ClientProcessingSketch/components/SketchOptions/utils/randomizeFields";

type RandomizeFieldButtonProps = {
  /** Form path of the field to redraw. */
  name: string;
  config: FieldConfig;
  className?: string;
};

/**
 * Redraws **one** field, next to that field's own label — the granular
 * counterpart of {@link RandomizeSettingsButton}, which redraws a whole group.
 * It exists because the 2D pad is the one control whose value is a shape
 * rather than a number: nudging it by hand means agreeing on two coordinates
 * at once, so "try another one" is the natural gesture, and doing it from the
 * group button drags every other parameter along with it.
 *
 * Sized to match the modulation pastille it sits beside, since the pair reads
 * as one cluster of per-field actions.
 */
export default function RandomizeFieldButton( {
  name,
  config,
  className
}: RandomizeFieldButtonProps ) {
  const {
    getValues, setValue
  } = useFormContext();

  return (
    <button
      type="button"
      // Out of the tab order like the other per-field affordances: tabbing
      // through a panel should walk its values, not its actions.
      tabIndex={ -1 }
      title="Randomize this parameter"
      onClick={ ( event: React.MouseEvent ) => {
        event.stopPropagation();
        randomizeField(
          config,
          name,
          {
            getValues,
            setValue
          }
        );
      } }
      className={ className ?? "grid h-7 w-7 shrink-0 place-items-center rounded-md border border-theme text-label/60 outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-focus" }
    >
      <Shuffle className="h-3.5 w-3.5" />
    </button>
  );
}
