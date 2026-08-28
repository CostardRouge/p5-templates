"use client";

import React, {
  useEffect, useRef, useState
} from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import {
  Download
} from "lucide-react";

import type {
  SketchOption
} from "@/types/sketch.types";
import OptionsImportExport from "./CaptureActions/components/OptionsImportExport";
import type {
  CaptureActionsRef
} from "./CaptureActions";

// Same chunking rationale as SketchOptions: the recording subtree only
// compiles when this menu mounts.
const CaptureActions = dynamic( () => import( "./CaptureActions" ) );

type CaptureProps = Omit<
  React.ComponentPropsWithoutRef<typeof CaptureActions>,
  "activeSlideIndex" | "docked" | "forwardedRef"
>;

type ExportMenuProps = {
  activeSlideIndex: number | undefined;
  capture: CaptureProps;
  captureActionsRef: React.Ref<CaptureActionsRef>;
  recordingSupported: boolean;
  jobStatus?: string;
  onImportOptions: ( options: SketchOption ) => void;
  /** Keep the panel open (e.g. while a recording is running, so its progress
   *  stays visible). */
  forceOpen?: boolean;
};

/**
 * The docked top bar's Export entry: a solid button — the only filled control
 * on screen — opening a panel that hosts options import/export and the whole
 * capture/recording stack. The panel content stays mounted while closed
 * (visibility only): the capture ref is the autosave handle, and recordings
 * must survive the panel being closed.
 */
export default function ExportMenu( {
  activeSlideIndex,
  capture,
  captureActionsRef,
  recordingSupported,
  jobStatus,
  onImportOptions,
  forceOpen = false
}: ExportMenuProps ) {
  const [
    open,
    setOpen
  ] = useState( false );
  const rootRef = useRef<HTMLDivElement | null>( null );

  const effectiveOpen = open || forceOpen;

  // Close on outside click / Escape — but never while forced open.
  useEffect(
    () => {
      if ( !effectiveOpen ) {
        return;
      }

      const handlePointerDown = ( event: PointerEvent ) => {
        if (
          rootRef.current &&
          event.target instanceof Node &&
          !rootRef.current.contains( event.target )
        ) {
          setOpen( false );
        }
      };

      const handleKeyDown = ( event: KeyboardEvent ) => {
        if ( event.key === "Escape" ) {
          setOpen( false );
        }
      };

      document.addEventListener(
        "pointerdown",
        handlePointerDown
      );
      document.addEventListener(
        "keydown",
        handleKeyDown
      );

      return () => {
        document.removeEventListener(
          "pointerdown",
          handlePointerDown
        );
        document.removeEventListener(
          "keydown",
          handleKeyDown
        );
      };
    },
    [
      effectiveOpen
    ]
  );

  return (
    <div ref={ rootRef } className="relative flex h-full items-center px-2">
      <button
        type="button"
        onClick={ () => setOpen( ( prev ) => !prev ) }
        aria-expanded={ effectiveOpen }
        aria-haspopup="dialog"
        title="Recording, export and options import/export"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-85"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>

      <div
        className={ clsx(
          "absolute right-2 top-[calc(100%+0.25rem)] z-50 flex w-80 max-h-[calc(100svh-4.5rem)] flex-col gap-2 overflow-y-auto rounded-xl border border-theme glass p-2 shadow-lg",
          !effectiveOpen && "hidden"
        ) }
        role="dialog"
        aria-label="Export"
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
            forwardedRef={ captureActionsRef }
            activeSlideIndex={ activeSlideIndex }
            docked
            { ...capture }
          />
        ) : (
          <p className="py-2 text-center text-xs text-label">
            Recording is not supported in this browser.
          </p>
        )}
      </div>
    </div>
  );
}
