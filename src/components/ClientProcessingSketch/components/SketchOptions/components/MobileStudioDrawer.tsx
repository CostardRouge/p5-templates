"use client";

import React, {
  useEffect, useRef, useState
} from "react";
import clsx from "clsx";
import {
  ChevronDown, ChevronUp, SlidersHorizontal
} from "lucide-react";

import CollapsibleItem from "@/components/CollapsibleItem";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import GenericObjectForm
  from "./RootSettings/components/GenericObjectForm/GenericObjectForm";
import RootSettings from "./RootSettings/RootSettings";
import PanelSection from "./PanelSection";
import SlideFilmstrip, {
  type SlideFilmstripProps
} from "./SlideFilmstrip";
import SketchAssetsProvider from "./SketchAssetsProvider/SketchAssetsProvider";
import RecordingLockBanner from "./RecordingLockBanner";
import ImportSuccessBanner from "./ImportSuccessBanner";
import OptionsImportExport from "./CaptureActions/components/OptionsImportExport";
import UndoRedo from "./UndoRedo";
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

type Tab = "sketch" | "content" | "export";

type CaptureProps = Omit<
  React.ComponentPropsWithoutRef<typeof CaptureActions>,
  "activeSlideIndex"
>;

type MobileStudioDrawerProps = {
  expanded?: boolean;
  onToggle?: ( expanded: boolean ) => void;
  activeSlideIndex?: number;
  /** Stable id of the active slide; remounts the form on identity changes. */
  activeSlideId?: string;
  jobId?: string;
  /** Content tab: the content rail sections. */
  body: Omit<OptionsPanelBodyProps, "scrollable">;
  /** Slide strip pinned above the tab content, visible on every tab. */
  filmstrip: Omit<SlideFilmstripProps, "thumbnailHeight" | "className">;
  /** Expand state of the "canvas & animation" section (shared with desktop). */
  rootSettingsExpanded?: boolean;
  onRootSettingsToggle?: ( expanded: boolean ) => void;
  /** Expand state of the sketch's own "N options" section. */
  sketchSectionExpanded?: boolean;
  onSketchSectionToggle?: ( expanded: boolean ) => void;
  /** Export tab: capture actions (recording support already filtered by caller). */
  capture: CaptureProps;
  captureActionsRef: React.Ref<CaptureActionsRef>;
  recordingSupported: boolean;
  jobStatus?: string;
  onImportOptions: ( options: SketchOption ) => void;
  bannerCloning: boolean;
  onBannerClone: () => void;
  importBanner: string | null;
  onImportBannerDismiss: () => void;
};

/**
 * Single bottom drawer hosting the whole studio on mobile: Sketch, Settings
 * and Export tabs share one surface (and the form context owned by
 * SketchOptions), so the panels never compete for the small screen.
 * Desktop keeps the separate floating panels.
 */
export default function MobileStudioDrawer( {
  expanded,
  onToggle,
  activeSlideIndex,
  activeSlideId,
  jobId,
  body,
  filmstrip,
  rootSettingsExpanded,
  onRootSettingsToggle,
  sketchSectionExpanded,
  onSketchSectionToggle,
  capture,
  captureActionsRef,
  recordingSupported,
  jobStatus,
  onImportOptions,
  bannerCloning,
  onBannerClone,
  importBanner,
  onImportBannerDismiss
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
  ] = useState<Tab>( "sketch" );

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

  // "Sketch" always exists now: it hosts canvas & animation even when the
  // sketch exposes no parameters of its own.
  const tabs: Array<{ id: Tab;
    label: string }> = [
    {
      id: "sketch",
      label: "Sketch"
    },
    {
      id: "content",
      label: "Content"
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
        // Float like the app menu / zoom controls: matching side + bottom
        // margins, full border and corner radius (rounded-xl, not a pill or a
        // flush bottom sheet). Collapsed spans the full width too, with the
        // expand chevron pinned right like the collapse one when open.
        expanded
          ? "left-2 right-2 bottom-2 z-[60] max-h-[50svh] rounded-xl border border-theme overflow-y-auto overscroll-contain"
          : "left-2 right-2 bottom-2 z-50 rounded-xl border border-theme overflow-hidden"
      ) }
      // Opaque (not glass) so scrolled content can't bleed through the sticky
      // tabs / drag handle, and above the form fields in the stacking order.
      headerContainerClassName={ clsx( expanded && "bg-background sticky top-0 z-20" ) }
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

              <div className="shrink-0 px-1">
                <UndoRedo />
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
              className="flex w-full items-center gap-1.5 px-3.5 py-2.5 text-sm text-foreground"
              aria-label="Expand panel"
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" />
              <span>Settings</span>
              <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-label" />
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

        {importBanner && (
          <div className="mb-2">
            <ImportSuccessBanner
              message={ importBanner }
              onDismiss={ onImportBannerDismiss }
            />
          </div>
        )}

        {/* Slide strip: navigation, not a setting — visible on every tab so
            switching slides never requires switching tabs. */}
        <div className="mb-2 -mx-1">
          <SlideFilmstrip { ...filmstrip } thumbnailHeight={ 48 } />
        </div>

        {/* Tabs stay mounted (hidden) so form fields, capture state and the
            autosave handle survive switching. */}
        <div className={ clsx( activeTab !== "sketch" && "hidden" ) }>
          <RootSettings
            activeSlideIndex={ activeSlideIndex }
            expanded={ rootSettingsExpanded }
            onToggle={ onRootSettingsToggle }
            paddingClassName="px-0"
          />

          {sketchConfig && (
            <PanelSection
              label={
                sketchFormValues
                  ? `${ Object.keys( sketchFormValues ).length } options`
                  : "options"
              }
              expanded={ sketchSectionExpanded }
              onToggle={ onSketchSectionToggle }
              paddingClassName="px-0"
              bodyPaddingClassName="px-0"
              actions={
                <SketchSettingsActions
                  config={ sketchConfig }
                  basePath={ effectiveBasePath }
                />
              }
              last
            >
              <SketchAssetsProvider
                scope="global"
                assetsName="assets"
                jobId={ jobId }
              >
                <GenericObjectForm
                  key={ activeSlideId ?? effectiveBasePath }
                  basePath={ effectiveBasePath }
                  config={ sketchConfig }
                />
              </SketchAssetsProvider>
            </PanelSection>
          )}
        </div>

        <div className={ clsx( activeTab !== "content" && "hidden" ) }>
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
