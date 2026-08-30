"use client";

import React, {
  useEffect
} from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import {
  X
} from "lucide-react";

import type {
  SketchOption
} from "@/types/sketch.types";
import OptionsImportExport from "./CaptureActions/components/OptionsImportExport";
import type {
  CaptureActionsRef
} from "./CaptureActions";

// Same chunking rationale as SketchOptions: the recording subtree (mediabunny
// + gif.js encoders, the action buttons, VideoPreviewModal) only compiles when
// this dialog mounts.
const CaptureActions = dynamic( () => import( "./CaptureActions" ) );

type CaptureProps = Omit<
  React.ComponentPropsWithoutRef<typeof CaptureActions>,
  "activeSlideIndex" | "docked" | "forwardedRef"
>;

type CaptureDialogProps = {
  open: boolean;
  onClose: () => void;
  activeSlideIndex: number | undefined;
  capture: CaptureProps;
  captureActionsRef: React.Ref<CaptureActionsRef>;
  recordingSupported: boolean;
  jobStatus?: string;
  onImportOptions: ( options: SketchOption ) => void;
  /** Present as a bottom sheet instead of a centred dialog — the mobile shape,
   *  where a centred 320px card would float in the middle of a phone. */
  bottomSheet?: boolean;
};

/**
 * Recording and export, in one modal: the format/encoder pickers, the capture
 * actions and the job state, plus options import/export.
 *
 * It is the single home for that stack — opened by the transport bar's record
 * dot (and, in the docked layout, by the top bar's Export button), never
 * duplicated per layout.
 *
 * The content stays MOUNTED while closed (visibility only, not conditional
 * rendering): `captureActionsRef` is the autosave handle the form calls into,
 * and a running recording must survive the dialog being dismissed.
 */
export default function CaptureDialog( {
  open,
  onClose,
  activeSlideIndex,
  capture,
  captureActionsRef,
  recordingSupported,
  jobStatus,
  onImportOptions,
  bottomSheet = false
}: CaptureDialogProps ) {
  useEffect(
    () => {
      if ( !open ) {
        return;
      }

      const handleKeyDown = ( event: KeyboardEvent ) => {
        if ( event.key === "Escape" ) {
          onClose();
        }
      };

      document.addEventListener(
        "keydown",
        handleKeyDown
      );

      return () => document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    },
    [
      open,
      onClose
    ]
  );

  return (
    <div
      className={ clsx(
        "absolute inset-0 z-[70] flex justify-center",
        bottomSheet ? "items-end" : "items-center p-4",
        !open && "pointer-events-none"
      ) }
      aria-hidden={ !open }
    >
      {/* Backdrop: only painted (and clickable) while open, so the mounted-but-
          hidden dialog never swallows pointer events over the sketch. */}
      <div
        className={ clsx(
          "absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "opacity-0"
        ) }
        onClick={ onClose }
      />

      <div
        role="dialog"
        aria-modal={ open }
        aria-label="Recording and export"
        className={ clsx(
          "relative flex flex-col overflow-hidden border border-theme glass shadow-lg",
          bottomSheet
            // A sheet slides: interpolating opacity alone reads as a flash on
            // a full-width panel, so it moves on transform and the bottom
            // corners meet the screen edge.
            ? clsx(
              "w-full max-h-[85svh] rounded-2xl rounded-b-none border-b-0 transition-transform duration-200 ease-out motion-reduce:transition-none pb-[max(0.75rem,env(safe-area-inset-bottom))]",
              open ? "translate-y-0" : "translate-y-full"
            )
            : clsx(
              "w-80 max-h-full rounded-2xl transition-opacity",
              open ? "opacity-100" : "opacity-0"
            )
        ) }
      >
        {bottomSheet && (
          <div className="flex justify-center pt-2">
            <div className="h-1 w-10 rounded-full bg-foreground/20" />
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-theme px-3 py-2">
          <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
          <span className="text-xs font-medium text-foreground">Record</span>

          <button
            type="button"
            onClick={ onClose }
            aria-label="Close"
            className="ml-auto rounded-lg p-1 text-label transition-colors hover:bg-hover hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto p-2">
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

          <div className="flex border-t border-theme pt-2">
            <OptionsImportExport
              options={ capture.options }
              name={ capture.name }
              persistedJobId={ capture.persistedJob?.id }
              jobStatus={ jobStatus }
              onImportInMemory={ ( importedOptions ) =>
                onImportOptions( importedOptions as SketchOption ) }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
