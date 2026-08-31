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
  SketchLayerItemSchema,
  VisualItemSchema,
  QrCodeItemSchema,
  TitleItemSchema
} from "@/types/sketch.types";

import {
  ItemKind
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";

/**
 * A fresh content item of the given kind, parsed through its schema so every
 * field carries its default. `seed` pre-fills fields on top of those defaults
 * (the HUD quick-add uses it to bind a new element's `source` to the control
 * it was created from); the discriminant always wins over a seeded `type`.
 */
export default function makeDefaultItem(
  type: ItemKind, seed: Record<string, unknown> = {}
): ContentItem {
  switch ( type ) {
    case "text":
      return TextItemSchema.parse( {
        content: "new text",
        ...seed,
        type
      } );
    case "title":
      return TitleItemSchema.parse( {
        ...seed,
        type
      } );
    case "image":
      return ImageItemSchema.parse( {
        ...seed,
        type
      } );
    case "images-stack":
      return ImagesStackItemSchema.parse( {
        ...seed,
        type
      } );
    case "meta":
      return MetaItemSchema.parse( {
        ...seed,
        type
      } );
    case "specs":
      return SpecsItemSchema.parse( {
        ...seed,
        type
      } );
    case "breakdown":
      return BreakdownItemSchema.parse( {
        ...seed,
        type
      } );
    case "hud-badge":
      return HudBadgeItemSchema.parse( {
        ...seed,
        type
      } );
    case "hud-gauge":
      return HudGaugeItemSchema.parse( {
        ...seed,
        type
      } );
    case "hud-sparkline":
      return HudSparklineItemSchema.parse( {
        ...seed,
        type
      } );
    case "hud-counter":
      return HudCounterItemSchema.parse( {
        ...seed,
        type
      } );
    case "hud-crosshairs":
      return HudCrosshairsItemSchema.parse( {
        ...seed,
        type
      } );
    case "hud-swatch":
      return HudSwatchItemSchema.parse( {
        ...seed,
        type
      } );
    case "hud-bounding-box":
      return HudBoundingBoxItemSchema.parse( {
        ...seed,
        type
      } );
    case "background":
      return BackgroundItemSchema.parse( {
        ...seed,
        type
      } );
    case "visual":
      return VisualItemSchema.parse( {
        ...seed,
        type
      } );
    // The picker seeds `sketch` (the catalogue path) and `settings` (that
    // sketch's own formValues) — a sketch layer with neither renders nothing,
    // which is why the palette tile opens the picker instead of adding blind.
    case "sketch":
      return SketchLayerItemSchema.parse( {
        ...seed,
        type
      } );
    case "qrcode":
      return QrCodeItemSchema.parse( {
        ...seed,
        type
      } );
    default:
      throw new Error( `Unsupported kind: ${ type }` );
  }
}
