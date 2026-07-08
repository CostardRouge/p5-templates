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
import UiSoundSettingsButton from "./UiSoundSettingsButton";
import {
  playAction
} from "@/lib/uiSound";
import GenericObjectForm
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/RootSettings/components/GenericObjectForm/GenericObjectForm";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import type {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  injectSketchSchemas
} from "./utils/injectSketchSchemas";

type SketchSettingsProps = {
  basePath?: string;
  activeSlideIndex?: number;
  /** Stable id of the active slide; remounts the form on identity changes. */
  activeSlideId?: string;
  expanded?: boolean;
  onToggle?: ( expanded: boolean ) => void;
  /** Render as the flat, full-height docked left rail instead of a floating
   *  card. */
  docked?: boolean;
};

const HEADER_ACTION_CLASS =
  "p-2 md:p-1 text-foreground hover:bg-hover rounded-lg transition-colors";

/**
 * Resolves the sketch's form configuration (with schemas injected) and the
 * form path it edits — the global sketch settings, or the active slide's
 * overrides. Shared by the desktop panel and the mobile drawer tab.
 */
export function useSketchSettings(
  basePath?: string,
  activeSlideIndex?: number
): {
  config: Record<string, FieldConfig> | undefined;
  effectiveBasePath: string;
} {
  const [
    {
      sketchFormConfiguration, name
    }
  ] = useSketch();

  // Inject schemas on the client side
  const config = useMemo(
    () => {
      if ( !sketchFormConfiguration ) {
        return undefined;
      }

      const withSchemas = injectSketchSchemas(
        name,
        sketchFormConfiguration
      );

      return Object.keys( withSchemas ).length > 0 ? withSchemas : undefined;
    },
    [
      name,
      sketchFormConfiguration
    ]
  );

  // Use slide-specific basePath if a slide is active, otherwise use global sketch settings
  const effectiveBasePath =
    activeSlideIndex !== undefined
      ? `slides.${ activeSlideIndex }.sketch`
      : ( basePath ?? "sketch" );

  return {
    config,
    effectiveBasePath
  };
}

/** Reset / randomize / dev action buttons shared by panel and drawer. */
export function SketchSettingsActions( {
  config,
  basePath
}: {
  config: Record<string, FieldConfig>;
  basePath: string;
} ) {
  return (
    <>
      {/* Outside the capture wrapper below so tweaking sound settings doesn't
          itself fire action clicks. */}
      <UiSoundSettingsButton className={ HEADER_ACTION_CLASS } />

      {/* display:contents keeps the row layout untouched while catching every
          action click for the audible confirmation (see @/lib/uiSound). */}
      <span
        style={ {
          display: "contents"
        } }
        onClickCapture={ () => playAction() }
      >
        <ResetSettingsButton
          basePath={ basePath }
          className={ HEADER_ACTION_CLASS }
        />

        <RandomizeSettingsButton
          config={ config }
          basePath={ basePath }
          className={ HEADER_ACTION_CLASS }
        />

        <SaveDefaultsButton />

        <GenerateThumbnailButton />

        <GeneratePreviewButton />
      </span>
    </>
  );
}

/**
 * Desktop sketch-settings panel. Floating: a collapsible card bottom-left.
 * Docked: a flat, full-height left rail (always open — the rail supplies the
 * surface, so no card chrome or collapse-to-pill). The mobile drawer hosts the
 * same form through {@link useSketchSettings}.
 */
export default function SketchSettings( {
  basePath,
  activeSlideIndex,
  activeSlideId,
  expanded,
  onToggle,
  docked
}: SketchSettingsProps ) {
  const [
    {
      sketchFormValues
    }
  ] = useSketch();

  const {
    config, effectiveBasePath
  } = useSketchSettings(
    basePath,
    activeSlideIndex
  );

  if ( !config ) {
    return null;
  }

  // In the docked rail the panel is always open and never collapses to a pill.
  const effectiveExpanded = docked ? true : expanded;

  return (
    <CollapsibleItem
      expanded={ effectiveExpanded }
      onToggle={ docked ? undefined : onToggle }
      swipeToCollapse={ !docked }
      className={ clsx(
        "absolute flex flex-col glass shadow-lg overflow-y-auto border-theme",
        docked
          ? "z-40 left-0 top-12 bottom-0 w-80 border-r"
          : effectiveExpanded
            ? "z-50 left-4 bottom-4 w-80 max-h-[calc(80svh-5rem)] rounded-2xl border"
            : "z-50 left-4 bottom-4 w-fit rounded-full border"
      ) }
      headerContainerClassName={ clsx( ( effectiveExpanded || docked ) && "glass sticky top-0 z-10" ) }
      header={ ( isExpanded ) => (
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-foreground"
            aria-label={ isExpanded ? "Collapse controls" : "Expand controls" }
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>
              {sketchFormValues && `${ Object.keys( sketchFormValues ).length }`}{" "}
              options
              {activeSlideIndex !== undefined &&
                ` (slide ${ activeSlideIndex + 1 })`}
            </span>
            {!docked && (
              <ChevronDown
                className="h-3.5 w-3.5 transition-transform"
                style={ {
                  transform: isExpanded ? "rotate(0deg)" : "rotate(180deg)"
                } }
              />
            )}
          </button>

          {isExpanded && (
            <div
              className="flex items-center gap-0.5"
              onClick={ ( e ) => e.stopPropagation() }
            >
              <SketchSettingsActions
                config={ config }
                basePath={ effectiveBasePath }
              />
            </div>
          )}
        </div>
      ) }
    >
      <div className="px-3 pt-1 pb-4">
        <GenericObjectForm
          key={ activeSlideId ?? effectiveBasePath }
          basePath={ effectiveBasePath }
          config={ config }
        />
      </div>
    </CollapsibleItem>
  );
}
