import React from "react";
import {
  useFieldArray, useFormContext
} from "react-hook-form";

import GenericItemForm from "@/components/TemplateOptions/components/ContentLayerListForm/components/GenericItemForm";

type ContentLayerListFormProps = {
  baseFieldName: "content" | `slides.${ number }.content`;
};

export default function ContentLayerListForm( {
  baseFieldName
}: ContentLayerListFormProps ) {
  const {
    register, control
  } = useFormContext();

  const {
    fields, append, remove
  } = useFieldArray( {
    control,
    name: baseFieldName,
  } );

  // The layout path is also now dynamic
  const layoutFieldName = baseFieldName === "content" ? "layout" : baseFieldName.replace(
    ".content",
    ".layout"
  ) as "layout" | `slides.${ number }.layout`;

  return (
    <div className="text-xs flex flex-col gap-1">
      {/* --- Layout Selector --- */}
      {/* <label htmlFor={`${ layoutFieldName }-select`} className="mr-1 ">layout</label>*/}
      {/* <select*/}
      {/*  id={`${ layoutFieldName }-select`}*/}
      {/*  {...register( layoutFieldName )}*/}
      {/*  className="px-1 border rounded-sm w-full h-8"*/}
      {/* >*/}
      {/*  <option value="free">free</option>*/}
      {/*  <option value="grid">stack</option>*/}
      {/*  <option value="grid">grid</option>*/}
      {/* </select>*/}

      {/* --- Dynamic Content Items --- */}
      <div className="flex flex-col gap-1 p-1">
        {fields.map( (
          field, index
        ) => (
          <GenericItemForm
            index={index}
            baseFieldName={baseFieldName}
            key={`${ baseFieldName }-${ field.id }`}
            onRemove={() => remove( index )}
          />
        ) )}
      </div>

      {/* --- Add New Item --- */}
      {/* <AddItem onAdd={( item ) => append( item )} />*/}
    </div>
  );
}
