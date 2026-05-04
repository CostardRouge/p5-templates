"use client";

import {
  Maximize2, Minus, Plus
} from "lucide-react";

const ZoomControls = ( {
  onPlus,
  onMinus,
  onFit,
  onReset
}: {
  onPlus: () => void;
  onMinus: () => void;
  onReset: () => void;
  onFit: () => void;
} ) => {
  return (
    <div className="absolute top-2 right-2 md:top-4 md:right-4 flex items-center gap-2 z-50">
      <div className="flex items-center h-9 bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md overflow-hidden">
        <button
          onClick={onMinus}
          className="h-full px-3 hover:bg-hover transition-colors border-r border-border group inline-flex items-center justify-center"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className="w-4 h-4 text-foreground/70 group-hover:text-foreground transition-colors" />
        </button>

        <button
          onClick={onReset}
          className="h-full px-3 hover:bg-hover transition-colors border-r border-border group inline-flex items-center justify-center min-w-[3rem]"
          title="Reset to 100%"
          aria-label="Reset zoom to 100%"
        >
          <span className="text-xs font-semibold text-foreground/70 group-hover:text-foreground transition-colors leading-none">
            100%
          </span>
        </button>

        <button
          onClick={onPlus}
          className="h-full px-3 hover:bg-hover transition-colors group inline-flex items-center justify-center"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus className="w-4 h-4 text-foreground/70 group-hover:text-foreground transition-colors" />
        </button>
      </div>

      <button
        onClick={onFit}
        className="h-9 px-3 bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md hover:bg-hover transition-colors group inline-flex items-center justify-center"
        title="Fit to viewport"
        aria-label="Fit to viewport"
      >
        <Maximize2 className="w-4 h-4 text-foreground/70 group-hover:text-foreground transition-colors" />
      </button>
    </div>
  );
};

export default ZoomControls;
