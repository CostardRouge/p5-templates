"use client";

import React from "react";
import {
  CopyPlus
} from "lucide-react";
import {
  useFormContext
} from "react-hook-form";
import {
  applyToAllSlides, canApplyToAllSlides
} from "@/components/ClientProcessingSketch/components/SketchOptions/utils/applyToAllSlides";

type ApplyToAllSlidesButtonProps = {
  /** Full RHF path of the block/field to propagate, e.g. `slides.0.sketch.colors`. */
  basePath: string;
  className?: string;
};

/**
 * Icon button that copies the current block/field value onto every other slide.
 * Renders nothing unless we are editing a slide and there is more than one
 * slide — so it never shows up on single-slide sketches or the global settings.
 * Sits beside the shuffle/reset controls of a block header.
 */
export default function ApplyToAllSlidesButton( {
  basePath,
  className = "text-foreground hover:bg-theme/20 rounded transition-colors"
}: ApplyToAllSlidesButtonProps ) {
  const {
    getValues,
    setValue
  } = useFormContext();

  if ( !canApplyToAllSlides(
    getValues,
    basePath
  ) ) {
    return null;
  }

  const handleApply = ( event: React.MouseEvent ) => {
    event.stopPropagation();
    applyToAllSlides(
      getValues,
      setValue,
      basePath
    );
  };

  return (
    <button
      type="button"
      onClick={ handleApply }
      className={ className }
      title="Apply to all slides"
    >
      <CopyPlus className="w-3.5 h-3.5" />
    </button>
  );
}
