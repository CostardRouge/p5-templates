import {
  BackgroundItemSchema,
  BreakdownItemSchema,
  HudItemSchema,
  ImageItemSchema,
  ImagesStackItemSchema,
  MetaItemSchema,
  SpecsItemSchema,
  TextItemSchema,
  ContentItem,
  VisualItemSchema,
  QrCodeItemSchema,
  TitleItemSchema
} from "@/types/sketch.types";

import {
  ItemKind
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";

export default function makeDefaultItem( type: ItemKind ): ContentItem {
  switch ( type ) {
    case "text":
      return TextItemSchema.parse( {
        type,
        content: "new text"
      } );
    case "title":
      return TitleItemSchema.parse( {
        type
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
    case "specs":
      return SpecsItemSchema.parse( {
        type
      } );
    case "breakdown":
      return BreakdownItemSchema.parse( {
        type
      } );
    case "hud":
      return HudItemSchema.parse( {
        type
      } );
    case "background":
      return BackgroundItemSchema.parse( {
        type
      } );
    case "visual":
      return VisualItemSchema.parse( {
        type
      } );
    case "qrcode":
      return QrCodeItemSchema.parse( {
        type
      } );
    default:
      throw new Error( `Unsupported kind: ${ type }` );
  }
}
