"use client";

const defaultStyle = "absolute top-2 right-2 flex gap-1 z-50 text-xs text-foreground";

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
        className="rounded-xl glass border border-theme border-b-2 px-2 py-1"
      >
        100%
      </button>

      <button
        onClick={onPlus}
        className="rounded-xl glass border border-theme border-b-2 px-2 py-1"
      >
        +
      </button>

      <button
        onClick={onMinus}
        className="rounded-xl glass border border-theme border-b-2 px-2 py-1"
      >
        −
      </button>

      <button
        onClick={onFit}
        className="rounded-xl glass border border-theme border-b-2 px-2 py-1"
      >
        Fit
      </button>
    </div>
  );
};

export default ZoomControls;