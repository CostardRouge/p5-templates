import React from "react";
import {
  useFormContext
} from "react-hook-form";
import {
  ContentItem,
  SketchOption,
  ContentItemSchema
} from "@/types/sketch.types";

import {
  formConfig
} from "../constants/field-config";
import FieldRenderer from "../../FieldRenderer";
import EmbeddedSketchFields from "./SketchLayerPicker/EmbeddedSketchFields";

type GenericItemFormProps = {
  baseFieldName: "content" | `slides.${ number }.content`;
  index: number;
};

/**
 * The fields of one content item, and nothing else — the layers panel opens an
 * item as a detail view that supplies its own header (back arrow, name,
 * duplicate, delete), so this renders bare. It used to be wrapped in an
 * accordion card, back when every item was stacked in the rail at once.
 */
export default function GenericItemForm( {
  baseFieldName,
  index
}: GenericItemFormProps ) {
  const {
    watch
  } = useFormContext<SketchOption>();

  // Watch the 'type' field of this specific item to know what to render
  const itemType = watch( `${ baseFieldName }.${ index }.type` as any ) as ContentItem[ "type" ];

  // Find the Zod schema for this specific item type from the discriminated union
  const itemSchema = ContentItemSchema.options.find( ( schema ) => schema.shape.type.value === itemType );

  // Get the configuration for this item type
  const itemConfig = formConfig[ itemType ];

  if ( !itemSchema || !itemConfig ) {
    return (
      <div className="text-red-500 p-2">
        Error: No schema or config for type &#34;{itemType}&#34;
      </div>
    );
  }

  // Get the list of fields from the Zod schema's shape
  const fieldNames = Object.keys( itemSchema.shape );

  const itemPath = `${ baseFieldName }.${ index }`;

  return (
    <div className="flex flex-col gap-2">
      {fieldNames.map( ( fieldName ) => {
        // Don't render a field for the 'type' discriminator itself
        if ( fieldName === "type" ) {
          return null;
        }

        // An embedded sketch's own parameters have no fixed shape — they come
        // from whichever sketch the layer runs — so `settings` has no entry in
        // the static config table and is rendered below, from that sketch's
        // own formConfiguration.
        if ( itemType === "sketch" && fieldName === "settings" ) {
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
            key={ fieldName }
            fieldBasePath={ itemPath }
            fieldName={ fieldName }
            config={ fieldConfig }
          />
        );
      } )}

      {itemType === "sketch" && (
        <EmbeddedSketchFields itemPath={ itemPath } />
      )}
    </div>
  );
}
