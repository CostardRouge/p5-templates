import React from "react";
import {
  X, Copy
} from "lucide-react";
import CollapsibleItem from "@/components/CollapsibleItem";
import clsx from "clsx";
import {
  DragBinder
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/ContentItems";

export type ItemFormWrapperProps = {
  itemType: string;
  onRemove: () => void;
  onDuplicate: () => void;
  children: React.ReactNode;
  dragBinder?: DragBinder;
};

export default function ItemFormWrapper( {
  onRemove, onDuplicate, children, itemType, dragBinder
}: ItemFormWrapperProps ) {
  return (
    <CollapsibleItem
      initialExpandedValue={false}
      className="p-1 border rounded-sm bg-white hover:shadow hover:border-gray-300"
      header={expanded => (
        <div
          ref={dragBinder?.setHandleRef}
          {
            ...( dragBinder?.handleProps ?? {
            } )
          }
          className={
            clsx(
              "rounded-sm",
              "flex justify-between items-center",
              {
                "mb-2": expanded,
                "active:cursor-grabbing": dragBinder?.isDragging
              }
            )
          }
        >
          <h4 className="text-white bg-gray-800 px-1 rounded-sm">{itemType}</h4>

          <div className="">
            <button
              type="button"
              disabled
              onClick={event => {
                event.stopPropagation();
                onDuplicate();
              }}
              aria-label="Duplicate item"
            >
              <Copy className="mr-2 h-3.5 w-3.5 text-gray-500" />
            </button>

            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove layer"
              className="text-red-500 hover:text-red-700"
            >
              <X size={16}/>
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </CollapsibleItem>
  );
}