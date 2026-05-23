"use client";

import React from "react";
import {
  RotateCcw
} from "lucide-react";
import {
  useFormContext
} from "react-hook-form";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

type ResetSettingsButtonProps = {
  basePath: string;
};

export default function ResetSettingsButton( {
  basePath
}: ResetSettingsButtonProps ) {
  const [
    {
      sketchFormValues
    }
  ] = useSketch();
  const {
    setValue
  } = useFormContext();

  const handleReset = ( event: React.MouseEvent ) => {
    event.stopPropagation();

    setValue(
      basePath,
      sketchFormValues
    );
  };

  return (
    <button
      onClick={ handleReset }
      className="text-foreground hover:bg-theme/20 rounded transition-colors inline-flex items-center justify-center h-9 w-9 md:h-auto md:w-auto"
      title="Reset to defaults"
      aria-label="Reset to defaults"
    >
      <RotateCcw className="w-4 h-4 md:w-3.5 md:h-3.5" />
    </button>
  );
}
