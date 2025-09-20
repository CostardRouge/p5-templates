"use client";

const defaultStyle = "text-center absolute top-0 right-0 p-2 bg-white border-t-0 border border-gray-400 shadow shadow-black-300 drop-shadow-sm rounded-bl-sm border-r-0 flex gap-1 z-50";

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
        className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-xs text-gray-500 hover:text-black"
      >
        100%
      </button>

      <button
        onClick={onPlus}
        className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-xs text-gray-500 hover:text-black"
      >
        +
      </button>

      <button
        onClick={onMinus}
        className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-xs text-gray-500 hover:text-black"
      >
        −
      </button>

      <button
        onClick={onFit}
        className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-xs text-gray-500 hover:text-black"
      >
        Fit
      </button>
    </div>
  );
};

export default ZoomControls;