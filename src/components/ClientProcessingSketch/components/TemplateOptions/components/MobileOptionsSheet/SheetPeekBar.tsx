"use client";

import {
  Camera, ChevronUp, Pause, Play
} from "lucide-react";
import {
  ReactNode
} from "react";
import clsx from "clsx";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import type {
  SheetSnap
} from "@/components/MobileSheet/MobileSheet";

type SheetPeekBarProps = {
  snap: SheetSnap;
  onSnapChange: ( snap: SheetSnap ) => void;
  /** Optional trailing slot (e.g. record button). */
  trailing?: ReactNode;
};

export default function SheetPeekBar( {
  snap, onSnapChange, trailing
}: SheetPeekBarProps ) {
  const [
    {
      engine, looping, name, engineId
    },
    dispatch
  ] = useSketch();

  const expanded = snap !== "peek";

  const togglePlay = () => {
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

  const saveCanvas = () => {
    const canvas = engine?.getCanvas();

    if ( !canvas ) {
      return;
    }

    const link = document.createElement( "a" );

    link.download = `${ name }.png`;
    link.href = canvas.toDataURL( "image/png" );
    link.click();
  };

  const toggleExpand = () => {
    if ( snap === "peek" ) {
      onSnapChange( "half" );
    } else if ( snap === "half" ) {
      onSnapChange( "full" );
    } else {
      onSnapChange( "peek" );
    }
  };

  return (
    <div className="flex items-center gap-1 w-full">
      <button
        type="button"
        onClick={ togglePlay }
        className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-foreground/5 active:bg-foreground/10"
        aria-label={ looping ? "Pause animation" : "Play animation" }
      >
        {looping
          ? <Pause className="h-5 w-5" />
          : <Play className="h-5 w-5" />}
      </button>

      <button
        type="button"
        onClick={ saveCanvas }
        className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-foreground/5 active:bg-foreground/10"
        aria-label="Save canvas as image"
      >
        <Camera className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0 text-xs font-mono text-foreground/60 truncate px-1">
        {name}
        <span className="text-foreground/30"> · {engineId}</span>
      </div>

      {trailing}

      <button
        type="button"
        onClick={ toggleExpand }
        className="h-10 px-3 inline-flex items-center justify-center rounded-xl bg-foreground/5 active:bg-foreground/10 text-xs font-medium"
        aria-label={ expanded ? "Collapse options" : "Expand options" }
      >
        <ChevronUp
          className={ clsx(
            "h-5 w-5 transition-transform",
            expanded && "rotate-180"
          ) }
        />
      </button>
    </div>
  );
}
