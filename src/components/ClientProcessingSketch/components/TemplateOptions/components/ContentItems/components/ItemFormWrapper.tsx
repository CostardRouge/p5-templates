import React from "react";
import {
  Trash2, Copy
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
      className="p-1 border rounded-sm bg-white hover:shadow-sm hover:border-gray-300"
      header={expanded => (
        <div
          ref={dragBinder?.setHandleRef}
          {
            ...( dragBinder?.handleProps ?? {
            } )
          }
          className={
            clsx(
              "flex items-center",
              {
                "mb-2": expanded,
                "active:cursor-grabbing": dragBinder?.isDragging
              }
            )
          }
        >
          <h4 className="text-white bg-gray-800 px-1 rounded-sm">{itemType}</h4>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              disabled
              onClick={event => {
                event.stopPropagation();
                onDuplicate();
              }}
              aria-label="Duplicate item"
              className="cursor-copy"
            >
              <Copy className="h-3.5 w-3.5 text-gray-500" />
            </button>

            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove layer"
              className="inline-flex items-center justify-center rounded hover:bg-gray-100"

            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </CollapsibleItem>
  );
}