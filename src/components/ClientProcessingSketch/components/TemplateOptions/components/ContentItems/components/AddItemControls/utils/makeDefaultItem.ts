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

export default function makeDefaultItem( kind: ItemKind ): ContentItem {
  switch ( kind ) {
    case "text":
      return TextItemSchema.parse( {
        type: "text",
        content: "new text"
      } );
    case "image":
      return ImageItemSchema.parse( {
        type: "image"
      } );
    case "images-stack":
      return ImagesStackItemSchema.parse( {
        type: "images-stack"
      } );
    case "meta":
      return MetaItemSchema.parse( {
        type: "meta"
      } );
    case "background":
      return BackgroundItemSchema.parse( {
        type: "background"
      } );
    default:
      throw new Error( `Unsupported kind: ${ kind }` );
  }
}
