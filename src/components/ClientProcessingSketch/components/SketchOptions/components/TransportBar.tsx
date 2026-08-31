"use client";

import React from "react";
import clsx from "clsx";
import {
  Pause, Play
} from "lucide-react";

import AnimationProgressionBar from "@/components/AnimationProgressionBar";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import SnapshotButton from "./SnapshotButton";

// Elements Space already has a native or ARIA meaning on — text entry,
// buttons/links/controls (including the play button itself, which would
// otherwise double-toggle: its own click-on-Space plus this handler), and
// anything inside an open modal dialog.
const INTERACTIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "[contenteditable=\"true\"]",
  "[role=\"button\"]",
  "[role=\"checkbox\"]",
  "[role=\"switch\"]",
  "[role=\"slider\"]",
  "[role=\"menuitem\"]",
  "[role=\"tab\"]",
  "[role=\"dialog\"]",
  "[aria-modal=\"true\"]"
].join( ", " );

function isSpaceReservedTarget( target: EventTarget | null ) {
  const node = target as HTMLElement | null;

  if ( !node ) {
    return false;
  }

  return node.isContentEditable || Boolean( node.closest( INTERACTIVE_SELECTOR ) );
}

type TransportBarProps = {
  /** Opens the capture dialog — the record dot's only job. */
  onOpenCapture: () => void;
  /** True while a capture is running: the dot turns into a live indicator. */
  recording?: boolean;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * The transport: play/pause, the animation scrubber and its readout, the
 * snapshot button and the record dot that opens the capture dialog — one
 * full-width bar along the bottom edge for driving what the canvas is doing.
 *
 * It is the ONLY place playback and still capture are offered: the engine
 * controls used to duplicate both, an island's width away from the scrubber.
 *
 * Playback state lives in the sketch context (engine + `looping`), so the
 * button stays in sync with the page-visibility pause.
 */
export default function TransportBar( {
  onOpenCapture,
  recording = false,
  onSeekStart,
  onSeekEnd,
  className,
  style
}: TransportBarProps ) {
  const [
    {
      engine, looping, browserRecording
    },
    dispatch
  ] = useSketch();

  const togglePlayback = React.useCallback(
    () => {
      if ( looping ) {
        engine?.pause();
      } else {
        engine?.play();
      }

      dispatch( {
        type: "SET_LOOPING",
        payload: !looping
      } );
    },
    [
      engine,
      looping,
      dispatch
    ]
  );

  // Spacebar toggles play/pause from anywhere on the page, matching the
  // convention of every video/timeline editor — except while it would step on
  // a focused control's own use of the key (see isSpaceReservedTarget) or
  // while recording locks the transport (mirrors the button's `disabled`).
  React.useEffect(
    () => {
      if ( browserRecording ) {
        return;
      }

      const onKeyDown = ( event: KeyboardEvent ) => {
        if ( event.code !== "Space" || event.repeat ) {
          return;
        }
        if ( event.metaKey || event.ctrlKey || event.altKey ) {
          return;
        }
        if ( isSpaceReservedTarget( event.target ) ) {
          return;
        }

        event.preventDefault();
        togglePlayback();
      };

      window.addEventListener(
        "keydown",
        onKeyDown
      );

      return () => window.removeEventListener(
        "keydown",
        onKeyDown
      );
    },
    [
      browserRecording,
      togglePlayback
    ]
  );

  return (
    <div
      role="group"
      aria-label="Transport"
      // A bar, not an island: full width, flush with the bottom edge, square
      // corners and a single top rule. It is the floor every other panel
      // stacks on, so it carries no radius and no shadow of its own.
      className={ clsx(
        "flex h-12 w-full items-center gap-2 border-t border-theme glass px-3",
        className
      ) }
      style={ style }
    >
      <button
        type="button"
        onClick={ togglePlayback }
        disabled={ browserRecording }
        title={
          browserRecording
            ? "Locked while recording"
            : looping
              ? "Pause animation"
              : "Play animation"
        }
        aria-label={ looping ? "Pause playback" : "Start playback" }
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        {looping ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      <AnimationProgressionBar
        variant="inline"
        onSeekStart={ onSeekStart }
        onSeekEnd={ onSeekEnd }
      />

      {/* Snapshot: the current frame as a PNG, beside the record dot — one
          still, one moving image, the two ways out of the sketch. It also
          carries the dev double-click that writes the sketch's catalogue
          thumbnail, which used to sit in the engine-controls island. */}
      <SnapshotButton />

      {/* The one recording affordance on desktop, wearing the only red in the
          interface — the same meaning it already carries on mobile. */}
      <button
        type="button"
        onClick={ onOpenCapture }
        title="Recording and export options"
        aria-label="Open the capture dialog"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-hover"
      >
        <span
          className={ clsx(
            "block h-3.5 w-3.5 rounded-full bg-red-500/80 transition-colors",
            recording && "animate-pulse bg-red-500"
          ) }
        />
      </button>
    </div>
  );
}
