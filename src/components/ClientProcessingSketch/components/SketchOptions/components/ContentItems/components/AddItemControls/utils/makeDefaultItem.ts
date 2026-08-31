import {
  BackgroundItemSchema,
  BreakdownItemSchema,
  HudBadgeItemSchema,
  HudBoundingBoxItemSchema,
  HudCounterItemSchema,
  HudCrosshairsItemSchema,
  HudGaugeItemSchema,
  HudSparklineItemSchema,
  HudSwatchItemSchema,
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
    case "hud-badge":
      return HudBadgeItemSchema.parse( {
        type
      } );
    case "hud-gauge":
      return HudGaugeItemSchema.parse( {
        type
      } );
    case "hud-sparkline":
      return HudSparklineItemSchema.parse( {
        type
      } );
    case "hud-counter":
      return HudCounterItemSchema.parse( {
        type
      } );
    case "hud-crosshairs":
      return HudCrosshairsItemSchema.parse( {
        type
      } );
    case "hud-swatch":
      return HudSwatchItemSchema.parse( {
        type
      } );
    case "hud-bounding-box":
      return HudBoundingBoxItemSchema.parse( {
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
