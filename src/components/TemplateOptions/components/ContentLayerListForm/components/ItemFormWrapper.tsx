import React from "react";
import {
  X
} from "lucide-react";

export type ItemFormWrapperProps = {
  itemType: string;
  onRemove: () => void;
  children: React.ReactNode;
};

export default function ItemFormWrapper( {
  onRemove, children, itemType
}: ItemFormWrapperProps ) {
  return (
    <div className="p-1 border rounded-sm bg-white hover:shadow-md">
      <div className="flex justify-between items-center mb-2">
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

      {children}
    </div>
  );
}