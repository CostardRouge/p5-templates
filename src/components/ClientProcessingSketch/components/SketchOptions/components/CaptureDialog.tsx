"use client";

import React, {
  useEffect
} from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import {
  Download, X
} from "lucide-react";

import type {
  SketchOption
} from "@/types/sketch.types";
import type {
  CaptureActionsRef
} from "./CaptureActions";
import {
  useDevActions
} from "@/hooks/useDevActions";

// Same chunking rationale as SketchOptions: the recording subtree (mediabunny
// + gif.js encoders, the action buttons, VideoPreviewModal) only compiles when
// this dialog mounts.
const CaptureActions = dynamic( () => import( "./CaptureActions" ) );
const ExportPanel = dynamic( () => import( "./ExportPanel/ExportPanel" ) );

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
  /** Whether the browser can run the in-page export pipeline at all. */
  browserExportSupported: boolean;
  /** Present as a bottom sheet instead of a centred dialog — the mobile shape,
   *  where a centred dialog would float in the middle of a phone. */
  bottomSheet?: boolean;
};

/**
 * Export, in one modal: the variant list and its editor, plus the backend job
 * state.
 *
 * It is the single home for that stack on EVERY layout — opened by the
 * transport bar's record dot and, in the docked layout, the top bar's Export
 * button. A centred dialog on desktop, a bottom sheet on mobile, where the
 * drawer has no Export tab: a surface over the sketch keeps a running export
 * visible once the drawer is dismissed.
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
  browserExportSupported,
  bottomSheet = false
}: CaptureDialogProps ) {
  const {
    devActionsVisible
  } = useDevActions();

  const hasFooterActions =
    capture.backendRecording ||
      ( devActionsVisible && capture.browserRecordingSupported );

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
        aria-label="Export"
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
            // The export table needs room the old 320px card never did, so the
            // centred shape is a wide dialog rather than a narrow one.
            : clsx(
              "w-full max-w-3xl max-h-full rounded-2xl transition-opacity",
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
          <Download className="h-3.5 w-3.5 shrink-0 text-foreground" />
          <span className="text-xs font-medium text-foreground">Export</span>
          <span className="truncate text-xs text-label">{capture.name}</span>

          <button
            type="button"
            onClick={ onClose }
            aria-label="Close"
            className="ml-auto rounded-lg p-1 text-label transition-colors hover:bg-hover hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* The variant list + editor. Mounted only while the dialog is open:
            unlike CaptureActions it holds no autosave handle, and its own
            state lives in the export variant store, so it survives unmounting. */}
        {open && browserExportSupported && (
          <ExportPanel
            name={ capture.name }
            options={ capture.options as SketchOption }
            activeSlideIndex={ activeSlideIndex }
          />
        )}

        {!browserExportSupported && (
          <p className="px-3 py-6 text-center text-xs text-label">
            Exporting is not supported in this browser.
          </p>
        )}

        {/* Backend job actions + the dev preview capture. Options
            import/export deliberately does NOT live here: it is a document
            concern, and it stays in the content rail's own section.

            CaptureActions stays mounted whatever it renders — it carries the
            autosave handle — so the strip drops its own border and padding
            when there is nothing to show, rather than leaving an empty band
            under the table. */}
        {recordingSupported && (
          <div className={ clsx( hasFooterActions && "border-t border-theme p-2" ) }>
            <CaptureActions
              forwardedRef={ captureActionsRef }
              activeSlideIndex={ activeSlideIndex }
              docked
              { ...capture }
            />
          </div>
        )}
      </div>
    </div>
  );
}
