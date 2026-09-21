"use client";

import React, {
  useCallback, useEffect, useState
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
  /** Take the whole surface instead of floating in the middle of it — the
   *  mobile shape. */
  fullScreen?: boolean;
};

/**
 * Export, in one modal: the variant list and its editor, plus the backend job
 * state.
 *
 * It is the single home for that stack on EVERY layout — opened by the
 * transport bar's record dot and, in the docked layout, the top bar's Export
 * button. A centred dialog on desktop, the whole screen on mobile, where the
 * drawer has no Export tab.
 *
 * **Why full screen and not a bottom sheet** (2026-09-21): the sheet capped
 * itself at 85svh and sat on the bottom edge, so an export ran with the live
 * sketch drawing above it behind a `backdrop-filter` blur. That blur is a
 * full-screen GPU pass recomposited on every frame the sketch draws — paid for
 * during the capture, on the device least able to afford it — to show a sketch
 * nobody is looking at while they watch an export. Full screen removes the
 * blur along with the reason for it, and hands the variant list the height it
 * needed anyway.
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
  fullScreen = false
}: CaptureDialogProps ) {
  const {
    devActionsVisible
  } = useDevActions();

  // Files the export panel produced and the user has not saved anywhere. The
  // panel unmounts with the dialog (see the render below) and its blobs die
  // with it, so closing on a non-zero count throws away a finished export —
  // minutes of capture on a phone. Ask first.
  const [
    pendingFiles,
    setPendingFiles
  ] = useState( 0 );

  const requestClose = useCallback(
    () => {
      const one = pendingFiles === 1;
      const warning = [
        `${ pendingFiles } exported file${ one ? " has" : "s have" } not been saved yet.`,
        `Closing discards ${ one ? "it" : "them" }.`,
        "Close anyway?"
      ].join( " " );

      if ( pendingFiles > 0 && !confirm( warning ) ) {
        return;
      }

      onClose();
    },
    [
      onClose,
      pendingFiles
    ]
  );

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
          requestClose();
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
      requestClose
    ]
  );

  return (
    <div
      className={ clsx(
        "absolute inset-0 z-[70] flex justify-center",
        fullScreen ? "items-stretch" : "items-center p-4",
        !open && "pointer-events-none"
      ) }
      aria-hidden={ !open }
    >
      {/* Backdrop: only painted (and clickable) while open, so the mounted-but-
          hidden dialog never swallows pointer events over the sketch. It is not
          drawn at all full screen — nothing shows through an opaque panel that
          covers the surface, and a blur there is a per-frame GPU pass spent on
          pixels nobody sees. */}
      {!fullScreen && (
        <div
          className={ clsx(
            "absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity",
            open ? "opacity-100" : "opacity-0"
          ) }
          onClick={ requestClose }
        />
      )}

      <div
        role="dialog"
        aria-modal={ open }
        aria-label="Export"
        className={ clsx(
          "relative flex flex-col overflow-hidden",
          fullScreen
            // Opaque and edge to edge: no glass, no radius, no backdrop. It
            // slides up, because interpolating opacity alone reads as a flash
            // on a panel this size.
            ? clsx(
              "h-full w-full bg-background pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ease-out motion-reduce:transition-none",
              open ? "translate-y-0" : "translate-y-full"
            )
            // The export table needs room the old 320px card never did, so the
            // centred shape is a wide dialog rather than a narrow one.
            : clsx(
              "glass w-full max-w-3xl max-h-full rounded-2xl border border-theme shadow-lg transition-opacity",
              open ? "opacity-100" : "opacity-0"
            )
        ) }
      >
        <div
          className={ clsx(
            "flex items-center gap-2 border-b border-theme px-3",
            fullScreen
              ? "pb-2 pt-[max(0.625rem,env(safe-area-inset-top))]"
              : "py-2"
          ) }
        >
          <Download className="h-3.5 w-3.5 shrink-0 text-foreground" />
          <span className={ clsx(
            "font-medium text-foreground",
            fullScreen ? "text-sm" : "text-xs"
          ) }
          >
            Export
          </span>
          <span className={ clsx(
            "truncate text-label",
            fullScreen ? "text-sm" : "text-xs"
          ) }
          >
            {capture.name}
          </span>

          <button
            type="button"
            onClick={ requestClose }
            aria-label="Close"
            className={ clsx(
              "ml-auto flex items-center justify-center rounded-lg text-label transition-colors hover:bg-hover hover:text-foreground",
              // A real thumb target on a phone, where this is the only way out
              // now that there is no backdrop to tap.
              fullScreen ? "-mr-2 h-11 w-11" : "p-1"
            ) }
          >
            <X className={ fullScreen ? "h-4 w-4" : "h-3.5 w-3.5" } />
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
            onPendingChange={ setPendingFiles }
          />
        )}

        {!browserExportSupported && (
          <p className="bg-background px-3 py-6 text-center text-xs text-label">
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
