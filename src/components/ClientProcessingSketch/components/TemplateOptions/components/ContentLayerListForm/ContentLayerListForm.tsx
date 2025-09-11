import React from "react";

import AddItemControls from "./components/AddItemControls/AddItemControls";
import GenericItemForm from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentLayerListForm/components/GenericItemForm";
import useContentArray from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentArrayProvider/hooks/useContentArray";

type ContentItemsProps = {
  baseFieldName: "content" | `slides.${ number }.content`;
};

export default function ContentItems( {
  baseFieldName
}: ContentItemsProps ) {
  const {
    fields, remove
  } = useContentArray();

  // // The layout path is also now dynamic
  // const layoutFieldName = baseFieldName === "content" ? "layout" : baseFieldName.replace(
  //   ".content",
  //   ".layout"
  // ) as "layout" | `slides.${ number }.layout`;

  return (
    <div className="text-xs flex flex-col gap-1">
      <div className="flex flex-col gap-1 p-1 pt-0.5">
        <AddItemControls />

        {/* /!* --- Layout Selector ---*!/*/}
        {/* <label htmlFor={`${ layoutFieldName }-select`} className="mr-1 ">layout</label>*/}
        {/* <select*/}
        {/*  id={`${ layoutFieldName }-select`}*/}
        {/*  {...register( layoutFieldName )}*/}
        {/*  className="px-1 border rounded-sm w-full h-6"*/}
        {/* >*/}
        {/*  <option value="free">free</option>*/}
        {/*  <option value="grid">stack</option>*/}
        {/*  <option value="grid">grid</option>*/}
        {/* </select>*/}

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
    </div>
  );
}
