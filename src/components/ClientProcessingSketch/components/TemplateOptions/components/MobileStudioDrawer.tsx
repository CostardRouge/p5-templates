"use client";

import React, {
  useEffect, useRef, useState
} from "react";
import clsx from "clsx";
import {
  ChevronDown, SlidersHorizontal
} from "lucide-react";

import CollapsibleItem from "@/components/CollapsibleItem";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import GenericObjectForm
  from "./RootSettings/components/GenericObjectForm/GenericObjectForm";
import TemplateAssetsProvider from "./TemplateAssetsProvider/TemplateAssetsProvider";
import RecordingLockBanner from "./RecordingLockBanner";
import OptionsImportExport from "./CaptureActions/components/OptionsImportExport";
import CaptureActions, {
  type CaptureActionsRef
} from "./CaptureActions";
import {
  OptionsPanelBody, type OptionsPanelBodyProps
} from "./OptionsPanel";
import {
  useSketchSettings, SketchSettingsActions
} from "./SketchSettings/SketchSettings";
import {
  OPEN_EXPORT_DRAWER_EVENT, STUDIO_DRAWER_HEIGHT_VAR
} from "../constants/drawer-events";
import type {
  SketchOption
} from "@/types/sketch.types";

type Tab = "sketch" | "template" | "export";

type CaptureProps = Omit<
  React.ComponentPropsWithoutRef<typeof CaptureActions>,
  "activeSlideIndex"
>;

type MobileStudioDrawerProps = {
  expanded?: boolean;
  onToggle?: ( expanded: boolean ) => void;
  activeSlideIndex?: number;
  jobId?: string;
  /** Template tab: the options panel sections. */
  body: Omit<OptionsPanelBodyProps, "scrollable">;
  /** Export tab: capture actions (recording support already filtered by caller). */
  capture: CaptureProps;
  captureActionsRef: React.Ref<CaptureActionsRef>;
  recordingSupported: boolean;
  jobStatus?: string;
  onImportOptions: ( options: SketchOption ) => void;
  bannerCloning: boolean;
  onBannerClone: () => void;
};

/**
 * Single bottom drawer hosting the whole studio on mobile: Sketch, Template
 * and Export tabs share one surface (and the form context owned by
 * TemplateOptions), so the panels never compete for the small screen.
 * Desktop keeps the separate floating panels.
 */
export default function MobileStudioDrawer( {
  expanded,
  onToggle,
  activeSlideIndex,
  jobId,
  body,
  capture,
  captureActionsRef,
  recordingSupported,
  jobStatus,
  onImportOptions,
  bannerCloning,
  onBannerClone
}: MobileStudioDrawerProps ) {
  const [
    {
      sketchFormValues
    }
  ] = useSketch();

  const {
    config: sketchConfig, effectiveBasePath
  } = useSketchSettings(
    undefined,
    activeSlideIndex
  );

  const [
    activeTab,
    setActiveTab
  ] = useState<Tab>( sketchConfig ? "sketch" : "template" );

  // Publish the drawer's rendered height so the sketch viewport can shrink
  // to the area above it (and fit-to-viewport targets the visible half).
  // The ResizeObserver tracks the open/close animation and any future height
  // changes; collapsed (pill) reserves nothing.
  const rootRef = useRef<HTMLDivElement | null>( null );

  useEffect(
    () => {
      const setHeightVar = ( px: number ) =>
        document.documentElement.style.setProperty(
          STUDIO_DRAWER_HEIGHT_VAR,
          `${ Math.round( px ) }px`
        );

      const root = rootRef.current;

      if ( !expanded || !root ) {
        setHeightVar( 0 );

        return;
      }

      const observer = new ResizeObserver( () => {
        setHeightVar( root.getBoundingClientRect().height );
      } );

      observer.observe( root );

      return () => observer.disconnect();
    },
    [
      expanded
    ]
  );

  // Release the reserved space entirely when the drawer leaves the tree
  // (e.g. rotating into the desktop layout).
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty( STUDIO_DRAWER_HEIGHT_VAR );
    },
    []
  );

  // The engine controls' record shortcut opens the drawer on the Export tab.
  useEffect(
    () => {
      const handleOpenExport = () => {
        setActiveTab( "export" );
        onToggle?.( true );
      };

      window.addEventListener(
        OPEN_EXPORT_DRAWER_EVENT,
        handleOpenExport
      );

      return () => window.removeEventListener(
        OPEN_EXPORT_DRAWER_EVENT,
        handleOpenExport
      );
    },
    [
      onToggle
    ]
  );

  const tabs: Array<{ id: Tab;
    label: string }> = [
    ...( sketchConfig ? [
      {
        id: "sketch" as const,
        label: "Sketch"
      }
    ] : [] ),
    {
      id: "template",
      label: "Template"
    },
    {
      id: "export",
      label: "Export"
    }
  ];

  return (
    <CollapsibleItem
      rootRef={ rootRef }
      expanded={ expanded }
      onToggle={ onToggle }
      swipeToCollapse
      keepMounted
      className={ clsx(
        "absolute flex flex-col glass shadow-lg",
        expanded
          ? "inset-x-0 bottom-0 z-[60] max-h-[50svh] rounded-t-2xl border-t border-theme overflow-y-auto"
          : "left-2 bottom-2 z-50 w-fit rounded-full border border-theme overflow-hidden"
      ) }
      headerContainerClassName={ clsx( expanded && "glass sticky top-0 z-10" ) }
      header={ ( isExpanded ) => (
        <div className="flex w-full flex-col">
          {/* Drag handle (swipe down to close) */}
          {isExpanded && (
            <div className="flex justify-center pt-2">
              <div className="h-1 w-10 rounded-full bg-foreground/20" />
            </div>
          )}

          {isExpanded ? (
            <div
              className="flex items-center gap-1.5 px-3 py-2"
              onClick={ ( e ) => e.stopPropagation() }
            >
              {/* Segmented tab bar */}
              <div className="flex min-w-0 flex-1 gap-0.5 rounded-lg border border-theme bg-background p-0.5">
                {tabs.map( ( tab ) => (
                  <button
                    key={ tab.id }
                    type="button"
                    onClick={ () => setActiveTab( tab.id ) }
                    className={ clsx(
                      "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm transition-colors",
                      activeTab === tab.id
                        ? "bg-foreground font-medium text-background"
                        : "text-label hover:bg-hover"
                    ) }
                  >
                    {tab.label}
                  </button>
                ) )}
              </div>

              <button
                type="button"
                aria-label="Collapse panel"
                onClick={ () => onToggle?.( false ) }
                className="shrink-0 rounded-lg p-2 text-label hover:bg-hover hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-sm text-foreground"
              aria-label="Expand panel"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Settings</span>
              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            </button>
          )}
        </div>
      ) }
    >
      <div className="px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {capture.lifecycle.isLocked && (
          <div className="mb-2">
            <RecordingLockBanner
              state={ capture.lifecycle.state }
              onClone={ onBannerClone }
              cloning={ bannerCloning }
            />
          </div>
        )}

        {/* Tabs stay mounted (hidden) so form fields, capture state and the
            autosave handle survive switching. */}
        {sketchConfig && (
          <div className={ clsx( activeTab !== "sketch" && "hidden" ) }>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-label">
                {sketchFormValues &&
                  `${ Object.keys( sketchFormValues ).length } options`}
                {activeSlideIndex !== undefined &&
                  ` (slide ${ activeSlideIndex + 1 })`}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <SketchSettingsActions
                  config={ sketchConfig }
                  basePath={ effectiveBasePath }
                />
              </div>
            </div>

            <TemplateAssetsProvider
              scope="global"
              assetsName="assets"
              jobId={ jobId }
            >
              <GenericObjectForm
                key={ effectiveBasePath }
                basePath={ effectiveBasePath }
                config={ sketchConfig }
              />
            </TemplateAssetsProvider>
          </div>
        )}

        <div className={ clsx( activeTab !== "template" && "hidden" ) }>
          <OptionsPanelBody { ...body } scrollable={ false } />
        </div>

        <div
          className={ clsx(
            "flex flex-col gap-2",
            activeTab !== "export" && "hidden"
          ) }
        >
          <div className="flex">
            <OptionsImportExport
              options={ capture.options }
              name={ capture.name }
              persistedJobId={ capture.persistedJob?.id }
              jobStatus={ jobStatus }
              onImportInMemory={ ( importedOptions ) =>
                onImportOptions( importedOptions as SketchOption ) }
            />
          </div>

          {recordingSupported ? (
            <CaptureActions
              ref={ captureActionsRef }
              activeSlideIndex={ activeSlideIndex }
              { ...capture }
            />
          ) : (
            <p className="py-2 text-center text-xs text-label">
              Recording is not supported in this browser.
            </p>
          )}
        </div>
      </div>
    </CollapsibleItem>
  );
}
