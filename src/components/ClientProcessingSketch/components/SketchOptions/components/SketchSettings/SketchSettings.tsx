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
import ApplyToAllSlidesButton from "@/components/ApplyToAllSlidesButton";
import SaveDefaultsButton from "./SaveDefaultsButton";
import GenerateThumbnailButton from "./GenerateThumbnailButton";
import GeneratePreviewButton from "./GeneratePreviewButton";
import UiSoundSettingsButton from "./UiSoundSettingsButton";
import {
  playAction
} from "@/lib/uiSound";
import GenericObjectForm
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/RootSettings/components/GenericObjectForm/GenericObjectForm";
import RootSettings
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/RootSettings/RootSettings";
import PanelSection
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/PanelSection";
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
  /** Expand state of the "canvas & animation" section, lifted so the mobile
   *  drawer and the desktop panel share it. */
  rootSettingsExpanded?: boolean;
  onRootSettingsToggle?: ( expanded: boolean ) => void;
  /** Expand state of the sketch's own "N options" section. */
  sketchSectionExpanded?: boolean;
  onSketchSectionToggle?: ( expanded: boolean ) => void;
};

const HEADER_ACTION_CLASS =
  "p-2 md:p-1.5 text-foreground hover:bg-hover rounded-lg transition-colors";

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

/**
 * Action bar of the inspector: edit actions (reset / randomize / apply to all
 * slides), the dev production actions (save defaults / thumbnail / preview),
 * and the ui-sound toggle pushed to the far edge. Shared by the desktop
 * panel's sticky footer and the mobile drawer.
 */
export function SketchSettingsActions( {
  config,
  basePath
}: {
  config: Record<string, FieldConfig>;
  basePath: string;
} ) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <>
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

        <ApplyToAllSlidesButton
          basePath={ basePath }
          className={ HEADER_ACTION_CLASS }
        />

        {isDev && <span className="mx-1 h-4 w-px shrink-0 bg-border" />}

        <SaveDefaultsButton />

        <GenerateThumbnailButton />

        <GeneratePreviewButton />
      </span>

      {/* Outside the capture wrapper so tweaking sound settings doesn't
          itself fire action clicks. */}
      <span className="ml-auto">
        <UiSoundSettingsButton className={ HEADER_ACTION_CLASS } />
      </span>
    </>
  );
}

/**
 * The inspector: one panel for everything that parameterises what is on
 * screen. "Canvas & animation" (size, duration, framerate) on top, the
 * sketch's own parameters below, and the action bar pinned to the bottom.
 * Floating: a collapsible card bottom-left. Docked: a flat, full-height left
 * rail (always open — the rail supplies the surface). The mobile drawer hosts
 * the same pieces through {@link useSketchSettings}.
 */
export default function SketchSettings( {
  basePath,
  activeSlideIndex,
  activeSlideId,
  expanded,
  onToggle,
  docked,
  rootSettingsExpanded,
  onRootSettingsToggle,
  sketchSectionExpanded,
  onSketchSectionToggle
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

  // The panel header names the surface and its scope; the option count moved
  // down to title the sketch's own block, where it actually applies.
  const headerLabel = (
    <>
      <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate font-medium">Controls</span>
      {activeSlideIndex !== undefined && (
        <span className="truncate text-label">
          slide {activeSlideIndex + 1}
        </span>
      )}
    </>
  );

  const optionCount = sketchFormValues
    ? Object.keys( sketchFormValues ).length
    : undefined;

  const body = (
    <>
      <RootSettings
        activeSlideIndex={ activeSlideIndex }
        expanded={ rootSettingsExpanded }
        onToggle={ onRootSettingsToggle }
      />

      {config && (
        <PanelSection
          label={ optionCount !== undefined ? `${ optionCount } options` : "options" }
          expanded={ sketchSectionExpanded }
          onToggle={ onSketchSectionToggle }
          last
        >
          <GenericObjectForm
            key={ activeSlideId ?? effectiveBasePath }
            basePath={ effectiveBasePath }
            config={ config }
          />
        </PanelSection>
      )}
    </>
  );

  // Action bar pinned to the foot of the panel. A full-strength top rule and
  // slightly larger targets are what make it read as a bar instead of stray
  // icons on the form's surface.
  const actionBar = config && (
    <div
      className="flex items-center gap-0.5 px-2 py-1"
      onClick={ ( e ) => e.stopPropagation() }
    >
      <SketchSettingsActions
        config={ config }
        basePath={ effectiveBasePath }
      />
    </div>
  );

  // Docked rail: a plain flex column — fixed header, scrolling middle, fixed
  // footer — instead of CollapsibleItem (the rail never collapses, and the
  // collapse animation wrapper would keep the footer from pinning to the
  // rail's bottom edge when the form is short).
  if ( docked ) {
    return (
      <div className="absolute z-40 left-0 top-12 bottom-0 w-80 flex flex-col glass border-r border-theme shadow-lg">
        <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-foreground border-b border-theme">
          {headerLabel}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {body}
        </div>

        {actionBar && (
          <div className="glass border-t border-theme">
            {actionBar}
          </div>
        )}
      </div>
    );
  }

  // Floating card. Width and radius are CONSTANT across expanded/collapsed:
  // they used to switch w-80 <-> w-fit and rounded-2xl <-> rounded-full, which
  // are not animatable (auto width) and so snapped to a pill while the height
  // was still interpolating — the panel visibly morphed mid-animation. Only
  // the body's height animates now, and the card keeps its shape throughout.
  return (
    <CollapsibleItem
      expanded={ expanded }
      onToggle={ onToggle }
      swipeToCollapse
      className="absolute z-50 left-4 bottom-4 w-80 max-h-[calc(80svh-5rem)] flex flex-col glass shadow-lg overflow-y-auto rounded-2xl border border-theme"
      headerContainerClassName="glass sticky top-0 z-10"
      header={ ( isExpanded ) => (
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            className="flex min-w-0 items-center gap-1.5 text-xs text-foreground"
            aria-label={ isExpanded ? "Collapse controls" : "Expand controls" }
          >
            {headerLabel}
          </button>

          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-label transition-transform"
            style={ {
              transform: isExpanded ? "rotate(0deg)" : "rotate(180deg)"
            } }
          />
        </div>
      ) }
    >
      {body}

      {/* Sticky within the card's own scroll; when the form is short it sits
          right under it, which reads fine on a floating card. */}
      {actionBar && (
        <div className="sticky bottom-0 z-10 glass border-t border-theme">
          {actionBar}
        </div>
      )}
    </CollapsibleItem>
  );
}
