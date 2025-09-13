import {
  BackgroundItemSchema,
  ImageItemSchema,
  ImagesStackItemSchema,
  MetaItemSchema,
  TextItemSchema,
  ContentItem,
} from "@/types/sketch.types";

import {
  ItemKind
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";

export default function makeDefaultItem( type: ItemKind ): ContentItem {
  switch ( type ) {
    case "text":
      return TextItemSchema.parse( {
        type,
        content: "new text"
      } );
    case "image":
      return ImageItemSchema.parse( {
        type
      } );
    case "images-stack":
      return ImagesStackItemSchema.parse( {
        type
      } );
    case "meta":
      return MetaItemSchema.parse( {
        type
      } );
    case "background":
      return BackgroundItemSchema.parse( {
        type
      } );
    default:
      throw new Error( `Unsupported kind: ${ type }` );
  }
}
