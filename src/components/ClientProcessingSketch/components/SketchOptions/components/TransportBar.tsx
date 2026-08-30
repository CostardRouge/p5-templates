"use client";

import React, {
  useState
} from "react";
import clsx from "clsx";
import {
  Camera, Check, Pause, Play
} from "lucide-react";

import AnimationProgressionBar from "@/components/AnimationProgressionBar";
import {
  downloadCanvasPng
} from "@/lib/canvasSnapshot";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

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
 * The floating transport: play/pause, the animation scrubber, and the record
 * dot that opens the capture dialog — one pill for driving what the canvas is
 * doing, instead of a scrubber welded under the canvas and a separate capture
 * card in a corner.
 *
 * Playback state lives in the sketch context (engine + `looping`), so the
 * button stays in sync with the top bar's own play control and with the
 * page-visibility pause.
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
      engine, name, looping, browserRecording
    },
    dispatch
  ] = useSketch();

  // Brief tick after a snapshot: the download itself is invisible in most
  // browsers, so without it the button gives no sign it fired.
  const [
    snapped,
    setSnapped
  ] = useState( false );

  const handleSnapshot = async() => {
    const saved = await downloadCanvasPng(
      engine,
      name
    );

    if ( !saved ) {
      return;
    }

    setSnapped( true );
    setTimeout(
      () => setSnapped( false ),
      1200
    );
  };

  const togglePlayback = () => {
    if ( looping ) {
      engine?.pause();
    } else {
      engine?.play();
    }

    dispatch( {
      type: "SET_LOOPING",
      payload: !looping
    } );
  };

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
          still, one moving image, the two ways out of the sketch. */}
      <button
        type="button"
        onClick={ handleSnapshot }
        title="Save the current frame as a PNG"
        aria-label="Save the current frame as an image"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-hover"
      >
        {snapped ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
      </button>

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
