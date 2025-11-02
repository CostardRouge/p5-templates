"use client";

import React from "react";
import {
  ArrowDownFromLine
} from "lucide-react";

import CollapsibleItem from "@/components/CollapsibleItem";
import GenericObjectForm
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/RootSettings/components/GenericObjectForm/GenericObjectForm";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

type SketchSettingsProps = {
  basePath?: string;
};

export default function SketchSettings( {
  basePath = "sketch"
}: SketchSettingsProps ) {
  const {
    sketchFormConfiguration
  } = useSketch();

  if ( !sketchFormConfiguration ) {
    return null;
  }

  return (
    <CollapsibleItem
      data-no-zoom=""
      className="w-64 flex flex-col gap-1 absolute left-2 bottom-2 bg-background px-2 py-2 border border-theme z-50 rounded-xl"
      style={{
        maxHeight: "calc(80svh)",
        maxWidth: "calc(50% - 0.75rem)"
      }}
      header={( expanded ) => (
        <button
          className="text-foreground text-sm text-left w-full"
          aria-label={expanded ? "Collapse controls" : "Expand controls"}
        >
          <ArrowDownFromLine
            className="inline text-foreground h-3 w-3 mr-1"
            style={{
              rotate: expanded ? "0deg" : "180deg"
            }}
          />
          <span>sketch options</span>
        </button>
      )}
    >
      <GenericObjectForm basePath={basePath} config={sketchFormConfiguration} />
    </CollapsibleItem>
  );
}
