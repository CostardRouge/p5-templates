"use client";

import React, {
  useEffect, useMemo, useState
} from "react";
import {
  ArrowDownFromLine
} from "lucide-react";
import {
  get, useFormContext
} from "react-hook-form";

import CollapsibleItem from "@/components/CollapsibleItem";
import createSketchFormConfigFromDefaults
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/SketchSettings/utils/createSketchFormConfigFromDefaults";
import GenericObjectForm
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/RootSettings/components/GenericObjectForm/GenericObjectForm";

type SketchSettingsProps = {
  sketchName: string;
  basePath?: string;
};

export default function SketchSettings( {
  sketchName, basePath = "sketch"
}: SketchSettingsProps ) {
  const {
    setValue, getValues
  } = useFormContext();
  const [
    defaults,
    setDefaults
  ] = useState<Record<string, any> | null>( null );
  const [
    hints,
    setHints
  ] = useState<Record<string, any> | null>( null );

  useEffect(
    () => {
      ( async() => {
        try {
          const sketchMeta = await import( `@/p5-sketches/sketches/${ sketchName }/meta.ts` );

          if ( sketchMeta?.defaults ) {
            setDefaults( sketchMeta.defaults );
            setHints( sketchMeta.hints );
          }
        } catch {

        }
      } )();
    },
    [
      sketchName
    ]
  );

  useEffect(
    () => {
      if ( !defaults ) {
        return;
      }

      const existingValue = get(
        getValues(),
        basePath
      );

      console.log(
        "existingValue",
        existingValue
      );
      console.log(
        "defaults",
        defaults
      );

      // setValue(
      //   basePath,
      //   defaults,
      //   {
      //     shouldValidate: false,
      //     shouldDirty: false
      //   }
      // );
    },
    [
      defaults,
      basePath,
      setValue,
      getValues
    ]
  );

  const sketchSettingsFormConfig = useMemo(
    () => ( defaults ? createSketchFormConfigFromDefaults(
      defaults,
      hints ?? {
      }
    ) : null ),
    [
      defaults,
      hints
    ]
  );

  if ( !defaults ) {
    return null;
  }

  if ( !sketchSettingsFormConfig ) {
    return <div className="text-xs text-muted-foreground">Loading options…</div>;
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
      <GenericObjectForm basePath={basePath} config={sketchSettingsFormConfig} />
    </CollapsibleItem>
  );
}
