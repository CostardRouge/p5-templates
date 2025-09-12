import React from "react";
import {
  X
} from "lucide-react";
import CollapsibleItem from "@/components/CollapsibleItem";
import clsx from "clsx";

export type ItemFormWrapperProps = {
  itemType: string;
  onRemove: () => void;
  children: React.ReactNode;
};

export default function ItemFormWrapper( {
  onRemove, children, itemType
}: ItemFormWrapperProps ) {
  return (
    <CollapsibleItem
      initialExpandedValue={false}
      className="p-1 border rounded-sm bg-white hover:shadow hover:border-gray-300"
      header={expanded => (
        <div className={
          clsx(
            "rounded-sm",
            "flex justify-between items-center",
            {
              "mb-2": expanded
            }
          )
        }
        >
          <h4 className="text-white bg-gray-800 px-1 rounded-sm">{itemType}</h4>

          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove layer"
            className="text-red-500 hover:text-red-700"
          >
            <X size={16}/>
          </button>
        </div>
      )}
    >
      {children}
    </CollapsibleItem>
  );
}