import React from "react";
import {
  useFormContext
} from "react-hook-form";

import {
  X
} from "lucide-react";

type ItemFormProps = {
  index: number;
  onRemove: () => void;
  baseFieldName: "content" | `slides.${ number }.content`;
};

export default function UnsupportedItemForm( {
  onRemove, index, baseFieldName
}: ItemFormProps ) {
  const {
    register,
    getValues,
  } = useFormContext();

  const fieldName = `${ baseFieldName }.${ index }`;
  const data = getValues( fieldName );

  return (
    <div className="p-1 border  rounded-sm bg-white hover:shadow-md">
      <div className="flex justify-between items-center">
        <h4
          className="bg-red-200 px-1 rounded-sm"
          onClick={() => console.log( data )}
        >
          {data?.type}
        </h4>

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
  );
}
