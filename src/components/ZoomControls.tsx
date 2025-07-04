"use client";

import {
  useState
} from "react";
import {
  ArrowDownFromLine, ArrowUpFromLine
} from "lucide-react";

const ZoomControls = ( {
  onPlus, onMinus, onFit, onReset
}: {
  onPlus: () => void;
  onMinus: () => void;
  onReset: () => void;
  onFit: () => void;
} ) => {
  const [
    expanded,
    setExpanded
  ] = useState( true );

  return (
    <div
      data-no-zoom=""
      className="w-20 text-center absolute p-2 bg-white border border-gray-400 shadow shadow-black-300 drop-shadow-sm rounded-tr-sm border-l-0 bottom-0 left-0 z-50 flex flex-col gap-1"
    >
      <button
        onClick={() => setExpanded( e => !e )}
        className="text-gray-500 text-sm"
        aria-label={expanded ? "Collapse controls" : "Expand controls"}
      >
        <ArrowDownFromLine
          className="inline text-gray-500 h-4"
          style={{
            rotate: expanded ? "0deg" : "180deg"
          }}
        />
        <span>zoom</span>
      </button>

      {expanded && (
        <>
          <button
            onClick={ onPlus }
            className="mt-2 rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
          >
            +
          </button>

          <button
            onClick={onMinus}
            className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
          >
            −
          </button>

          <span className="h-2">-</span>

          <button
            onClick={ onFit}
            className="rounded-sm bg-white border border-gray-400 px-3 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
          >
            Fit
          </button>

          <button
            onClick={ onReset }
            className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-sm text-gray-500 hover:text-black"
          >
            100%
          </button>
        </>
      )}
    </div>
  );
};

export default ZoomControls;