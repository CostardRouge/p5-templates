import React from "react";
import {
  useFormContext
} from "react-hook-form";
import {
  ContentItem, SketchOption, ContentItemSchema
} from "@/types/sketch.types";

import {
  formConfig
} from "../constants/field-config";
import FieldRenderer from "./FieldRenderer";

import ItemFormWrapper from "./ItemFormWrapper";

type GenericItemFormProps = {
  baseFieldName: "content" | `slides.${ number }.content`;
  index: number;
  onRemove: () => void;
};

export default function GenericItemForm( {
  baseFieldName, index, onRemove
}: GenericItemFormProps ) {
  const {
    watch
  } = useFormContext<SketchOption>();

  // Watch the 'type' field of this specific item to know what to render
  const itemType = watch( `${ baseFieldName }.${ index }.type` as any ) as ContentItem["type"];

  // Find the Zod schema for this specific item type from the discriminated union
  const itemSchema = ContentItemSchema.options.find( ( schema ) => schema.shape.type.value === itemType );

  // Get the configuration for this item type
  const itemConfig = formConfig[ itemType ];

  if ( !itemSchema || !itemConfig ) {
    return <div className="text-red-500 p-2">Error: No schema or config for type "{itemType}"</div>;
  }

  // Get the list of fields from the Zod schema's shape
  const fieldNames = Object.keys( itemSchema.shape );

  return (
    <ItemFormWrapper onRemove={onRemove} itemType={itemType}>
      <div className="flex flex-col gap-2">
        {fieldNames.map( ( fieldName ) => {
          // Don't render a field for the 'type' discriminator itself
          if ( fieldName === "type" ) {
            return null;
          }

          const fieldConfig = itemConfig[ fieldName ];

          if ( !fieldConfig ) {
            // This is a helpful warning if you add a field to Zod but forget to configure it
            console.warn( `No form config found for field "${ fieldName }" in type "${ itemType }".` );
            return null;
          }

          return (
            <FieldRenderer
              key={fieldName}
              fieldBasePath={`${ baseFieldName }.${ index }`}
              fieldName={fieldName}
              config={fieldConfig}
            />
          );
        } )}
      </div>
    </ItemFormWrapper>
  );
}
