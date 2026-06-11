"use client";

import {
  Minus, Plus, Scan
} from "lucide-react";

const buttonClassName = "h-full px-3 hover:bg-hover transition-colors group inline-flex items-center justify-center";
const iconClassName = "w-4 h-4 text-foreground/70 group-hover:text-foreground transition-colors";

const ZoomControls = ( {
  scale,
  onPlus,
  onMinus,
  onFit,
  onReset
}: {
  scale: number;
  onPlus: () => void;
  onMinus: () => void;
  onReset: () => void;
  onFit: () => void;
} ) => {
  return (
    <div
      className="absolute top-2 right-2 md:top-4 md:right-4 z-50"
      data-no-drag="true"
    >
      <div className="flex items-center h-9 bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md overflow-hidden divide-x divide-border">
        <button
          onClick={ onMinus }
          className={ buttonClassName }
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className={ iconClassName } />
        </button>

        <button
          onClick={ onReset }
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
          className={ buttonClassName }
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus className={ iconClassName } />
        </button>

        <button
          onClick={ onFit }
          className={ buttonClassName }
          title="Fit to viewport"
          aria-label="Fit to viewport"
        >
          <Scan className={ iconClassName } />
        </button>
      </div>
    </div>
  );
};

export default ZoomControls;
