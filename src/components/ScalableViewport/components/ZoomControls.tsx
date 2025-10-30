"use client";

const defaultStyle = "absolute top-2 right-2 flex gap-1 z-50 text-xs";

const ZoomControls = ( {
  onPlus, onMinus, onFit, onReset
}: {
  onPlus: () => void;
  onMinus: () => void;
  onReset: () => void;
  onFit: () => void;
} ) => {
  return (
    <div className={defaultStyle}>
      <button
        onClick={onReset}
        className="rounded bg-background border border-theme border-b-2 px-2 py-1 text-foreground"
      >
        100%
      </button>

      <button
        onClick={onPlus}
        className="rounded bg-background border border-theme border-b-2 px-2 py-1 text-foreground"
      >
        +
      </button>

      <button
        onClick={onMinus}
        className="rounded bg-background border border-theme border-b-2 px-2 py-1  text-xs text-foreground "
      >
        −
      </button>

      <button
        onClick={onFit}
        className="rounded bg-background border border-theme border-b-2 px-2 py-1  text-xs text-foreground "
      >
        Fit
      </button>
    </div>
  );
};

export default ZoomControls;