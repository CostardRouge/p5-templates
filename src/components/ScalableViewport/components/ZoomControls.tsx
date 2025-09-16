"use client";

import {
  ArrowDownFromLine
} from "lucide-react";

import CollapsibleItem from "@/components/CollapsibleItem";

const defaultStyle = "w-20 text-center absolute p-2 bg-white border-b-0 border border-gray-400 shadow shadow-black-300 drop-shadow-sm rounded-tr-sm border-l-0 bottom-0 left-0 flex flex-col gap-1 z-50";
const alternativeStyle = "text-center absolute top-0 right-0 p-2 bg-white border-t-0 border border-gray-400 shadow shadow-black-300 drop-shadow-sm rounded-bl-sm border-r-0 flex gap-1 z-50";

const ZoomControls = ( {
  onPlus, onMinus, onFit, onReset
}: {
  onPlus: () => void;
  onMinus: () => void;
  onReset: () => void;
  onFit: () => void;
} ) => {
  return (
    <CollapsibleItem
      data-no-zoom=""
      header={expanded => (
        <button
          className="text-gray-500 text-sm"
          aria-label={expanded ? "Collapse controls" : "Expand controls"}
        >
          <ArrowDownFromLine
            className="inline text-gray-500 h-4"
            style={{
              rotate: expanded ? "270deg" : "90deg"
            }}
          />
          <span>zoom</span>
        </button>
      )}
      className={alternativeStyle}
    >
      <>
        <button
          onClick={onFit}
          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-xs text-gray-500 hover:text-black"
        >
          Fit
        </button>

        <button
          onClick={onMinus}
          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-xs text-gray-500 hover:text-black"
        >
          −
        </button>

        <button
          onClick={onPlus}
          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-xs text-gray-500 hover:text-black"
        >
          +
        </button>

        <button
          onClick={onReset}
          className="rounded-sm bg-white border border-gray-400 px-2 py-1 shadow shadow-gray-200 text-xs text-gray-500 hover:text-black"
        >
          100%
        </button>
      </>
    </CollapsibleItem>
  );
};

export default ZoomControls;