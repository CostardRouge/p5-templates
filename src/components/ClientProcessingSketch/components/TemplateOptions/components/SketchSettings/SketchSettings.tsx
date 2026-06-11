"use client";

import React, {
  useMemo
} from "react";
import {
  ChevronDown, SlidersHorizontal
} from "lucide-react";
import clsx from "clsx";

import CollapsibleItem from "@/components/CollapsibleItem";
import RandomizeSettingsButton from "@/components/RandomizeSettingsButton";
import ResetSettingsButton from "@/components/ResetSettingsButton";
import SaveDefaultsButton from "./SaveDefaultsButton";
import GenerateThumbnailButton from "./GenerateThumbnailButton";
import GeneratePreviewButton from "./GeneratePreviewButton";
import GenericObjectForm
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/RootSettings/components/GenericObjectForm/GenericObjectForm";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  injectSketchSchemas
} from "./utils/injectSketchSchemas";

type SketchSettingsProps = {
  basePath?: string;
  activeSlideIndex?: number;
  expanded?: boolean;
  onToggle?: ( expanded: boolean ) => void;
};

const HEADER_ACTION_CLASS =
  "p-2 md:p-1 text-foreground hover:bg-hover rounded-lg transition-colors";

export default function SketchSettings( {
  basePath,
  activeSlideIndex,
  expanded,
  onToggle
}: SketchSettingsProps ) {
  const [
    {
      sketchFormConfiguration, sketchFormValues, name
    }
  ] = useSketch();

  // Inject schemas on the client side
  const configWithSchemas = useMemo(
    () => {
      if ( !sketchFormConfiguration ) {
        return undefined;
      }

      return injectSketchSchemas(
        name,
        sketchFormConfiguration
      );
    },
    [
      name,
      sketchFormConfiguration
    ]
  );

  if ( !configWithSchemas || Object.keys( configWithSchemas ).length === 0 ) {
    return null;
  }

  // Use slide-specific basePath if a slide is active, otherwise use global sketch settings
  const effectiveBasePath =
    activeSlideIndex !== undefined
      ? `slides.${ activeSlideIndex }.sketch`
      : ( basePath ?? "sketch" );

  return (
    <CollapsibleItem
      expanded={ expanded }
      onToggle={ onToggle }
      swipeToCollapse
      className={ clsx(
        "absolute flex flex-col glass shadow-lg overflow-y-auto",
        expanded
          ? [
            // Mobile: full-width bottom drawer docked to the bottom edge,
            // above the other floating panels, capped at half the screen so
            // the sketch keeps the other half.
            "inset-x-0 bottom-0 z-[60] max-h-[50svh] rounded-t-2xl border-t border-theme",
            // Desktop: floating bottom-left panel.
            "md:inset-x-auto md:left-4 md:bottom-4 md:top-auto md:z-50 md:w-80 md:max-h-[calc(80svh-5rem)] md:rounded-2xl md:border"
          ]
          : "left-2 bottom-2 md:left-4 md:bottom-4 z-50 w-fit rounded-full border border-theme"
      ) }
      headerContainerClassName={ clsx( expanded && "glass sticky top-0 z-10" ) }
      header={ ( isExpanded ) => (
        <div className="flex w-full flex-col">
          {/* Drag handle, mobile sheet only (swipe down to close) */}
          {isExpanded && (
            <div className="flex justify-center pt-2 md:hidden">
              <div className="h-1 w-10 rounded-full bg-foreground/20" />
            </div>
          )}

          <div
            className={ clsx(
              "flex w-full items-center justify-between gap-2",
              isExpanded ? "px-3 py-2" : "px-3.5 py-2.5 md:px-3 md:py-2"
            ) }
          >
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm text-foreground md:text-xs"
              aria-label={ isExpanded ? "Collapse controls" : "Expand controls" }
            >
              <SlidersHorizontal className="h-4 w-4 md:h-3.5 md:w-3.5" />
              <span>
                {sketchFormValues && `${ Object.keys( sketchFormValues ).length }`}{" "}
                options
                {activeSlideIndex !== undefined &&
                  ` (slide ${ activeSlideIndex + 1 })`}
              </span>
              <ChevronDown
                className="h-3.5 w-3.5 transition-transform"
                style={ {
                  transform: isExpanded ? "rotate(0deg)" : "rotate(180deg)"
                } }
              />
            </button>

            {isExpanded && (
              <div
                className="flex items-center gap-0.5"
                onClick={ ( e ) => e.stopPropagation() }
              >
                <ResetSettingsButton
                  basePath={ effectiveBasePath }
                  className={ HEADER_ACTION_CLASS }
                />

                <RandomizeSettingsButton
                  config={ configWithSchemas }
                  basePath={ effectiveBasePath }
                  className={ HEADER_ACTION_CLASS }
                />

                <SaveDefaultsButton />

                <GenerateThumbnailButton />

                <GeneratePreviewButton />
              </div>
            )}
          </div>
        </div>
      ) }
    >
      <div className="px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4">
        <GenericObjectForm
          key={ effectiveBasePath }
          basePath={ effectiveBasePath }
          config={ configWithSchemas }
        />
      </div>
    </CollapsibleItem>
  );
}
