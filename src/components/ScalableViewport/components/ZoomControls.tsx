"use client";

import {
  Minus, Plus, Scan
} from "lucide-react";
import clsx from "clsx";

const buttonClassName = "h-full px-3 hover:bg-hover transition-colors group inline-flex items-center justify-center";
const iconClassName = "w-4 h-4 text-foreground/70 group-hover:text-foreground transition-colors";

const ZoomControls = ( {
  scale,
  onPlus,
  onMinus,
  onFit,
  onReset,
  disabled = false,
  variant = "floating"
}: {
  scale: number;
  onPlus: () => void;
  onMinus: () => void;
  onReset: () => void;
  onFit: () => void;
  // Recording owns the engine clock — surface the controls as inert so a
  // stray zoom can't disturb an in-flight capture.
  disabled?: boolean;
  // "floating" (default) is the rounded island top-right of the viewport;
  // "bar" renders the buttons flat for the docked workspace top bar.
  variant?: "floating" | "bar";
} ) => {
  const buttons = (
    <div
      className={ clsx(
        "flex items-center h-9 overflow-hidden divide-x divide-border transition-opacity",
        variant === "floating" &&
          "bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md",
        disabled && "opacity-40 pointer-events-none"
      ) }
      aria-hidden={ disabled }
    >
      <button
        onClick={ onMinus }
        disabled={ disabled }
        className={ buttonClassName }
        title="Zoom out"
        aria-label="Zoom out"
      >
        <Minus className={ iconClassName } />
      </button>

      <button
        onClick={ onReset }
        disabled={ disabled }
        className={ `${ buttonClassName } min-w-[3.5rem]` }
        title="Zoom to 100% (actual size)"
        aria-label="Zoom to 100% (actual size)"
      >
        <span className="text-xs font-semibold tabular-nums text-foreground/70 group-hover:text-foreground transition-colors leading-none">
          {Math.round( scale * 100 )}%
        </span>
      </button>

      <button
        onClick={ onPlus }
        disabled={ disabled }
        className={ buttonClassName }
        title="Zoom in"
        aria-label="Zoom in"
      >
        <Plus className={ iconClassName } />
      </button>

      <button
        onClick={ onFit }
        disabled={ disabled }
        className={ buttonClassName }
        title="Fit to viewport"
        aria-label="Fit to viewport"
      >
        <Scan className={ iconClassName } />
      </button>
    </div>
  );

  if ( variant === "bar" ) {
    return buttons;
  }

  return (
    <div
      className="absolute top-2 right-2 md:top-4 md:right-4 z-50"
      data-no-drag="true"
    >
      {buttons}
    </div>
  );
};

export default ZoomControls;
