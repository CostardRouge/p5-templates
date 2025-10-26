"use client";

const defaultStyle = "text-center absolute top-0 right-0 p-2 bg-background border-t-0 border border-theme  rounded-bl border-r-0 flex gap-1 z-50";

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
        className="rounded bg-background border border-theme px-2 py-1 text-xs text-foreground"
      >
        100%
      </button>

      <button
        onClick={onPlus}
        className="rounded bg-background border border-theme px-2 py-1  text-xs text-foreground "
      >
        +
      </button>

      <button
        onClick={onMinus}
        className="rounded bg-background border border-theme px-2 py-1  text-xs text-foreground "
      >
        −
      </button>

      <button
        onClick={onFit}
        className="rounded bg-background border border-theme px-2 py-1  text-xs text-foreground "
      >
        Fit
      </button>
    </div>
  );
};

export default ZoomControls;