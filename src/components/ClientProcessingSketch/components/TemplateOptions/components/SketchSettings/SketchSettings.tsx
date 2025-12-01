"use client";

import React, { useMemo } from "react";
import {
  ArrowDownFromLine
} from "lucide-react";

import CollapsibleItem from "@/components/CollapsibleItem";
import GenericObjectForm
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/RootSettings/components/GenericObjectForm/GenericObjectForm";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import { injectSketchSchemas } from "./utils/injectSketchSchemas";

type SketchSettingsProps = {
  basePath?: string;
  activeSlideIndex?: number;
};

export default function SketchSettings( {
  basePath,
  activeSlideIndex
}: SketchSettingsProps ) {
  const {
    sketchFormConfiguration, sketchFormValues, name
  } = useSketch();

  // Inject schemas on the client side
  const configWithSchemas = useMemo(() => {
    if (!sketchFormConfiguration) return undefined;
    return injectSketchSchemas(name, sketchFormConfiguration);
  }, [name, sketchFormConfiguration]);

  if ( !configWithSchemas || Object.keys( configWithSchemas ).length === 0 ) {
    return null;
  }

  // Use slide-specific basePath if a slide is active, otherwise use global sketch settings
  const effectiveBasePath = activeSlideIndex !== undefined
    ? `slides.${ activeSlideIndex }.sketch`
    : basePath ?? "sketch";

  return (
    <CollapsibleItem
      className="w-64 flex flex-col gap-1 absolute left-2 bottom-2 glass px-2 py-2 border border-theme z-50 rounded-2xl shadow-lg overflow-y-auto"
      style={{
        maxHeight: "calc(80svh - 5rem)",
        maxWidth: "calc(50% - 0.75rem)"
      }}
      header={( expanded ) => (
        <button
          className="text-foreground text-sm text-left"
          aria-label={expanded ? "Collapse controls" : "Expand controls"}
        >
          <ArrowDownFromLine
            className="inline text-foreground h-3 w-3 mr-1"
            style={{
              rotate: expanded ? "0deg" : "180deg"
            }}
          />
          <span>
            {sketchFormValues && `${ Object.keys( sketchFormValues ).length }`} sketch options
            {activeSlideIndex !== undefined && ` (slide ${ activeSlideIndex + 1 })`}
          </span>
        </button>
      )}
    >
      <div className="overflow-y-auto">
        <GenericObjectForm
          key={effectiveBasePath}
          basePath={effectiveBasePath}
          config={configWithSchemas}
        />
      </div>
    </CollapsibleItem>
  );
}
