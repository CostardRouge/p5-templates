import {
  Type as TextIcon,
  Heading as TitleIcon,
  Info as MetaIcon,
  Image as ImageIcon,
  Layers as StackIcon,
  PaintBucket as BgIcon,
  Blocks as SketchIcon,
  Terminal as SpecsIcon,
  QrCode as QrCodeIcon,
  ListOrdered as BreakdownIcon,
  Tag as BadgeIcon,
  Gauge as GaugeIcon,
  Activity as SparklineIcon,
  Hash as CounterIcon,
  Crosshair as CrosshairsIcon,
  Palette as SwatchIcon,
  Scan as BoundingBoxIcon
} from "lucide-react";
import {
  ItemKind,
  ItemKindGroup,
  ItemKindMeta
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";

export const ITEM_ORDER: ItemKind[] = [
  "sketch",
  "text",
  "title",
  "image",
  "images-stack",
  "meta",
  "specs",
  "breakdown",
  "background",
  "qrcode",
  "hud-badge",
  "hud-gauge",
  "hud-sparkline",
  "hud-counter",
  "hud-crosshairs",
  "hud-swatch",
  "hud-bounding-box"
];

// Palette sections: 17 flat tiles read as a wall, so the popover groups the
// telemetry family under its own eyebrow.
export const ITEM_GROUPS: ItemKindGroup[] = [
  {
    label: "Content",
    kinds: [
      "sketch",
      "text",
      "title",
      "image",
      "images-stack",
      "meta",
      "specs",
      "breakdown",
      "background",
      "qrcode"
    ]
  },
  {
    label: "HUD / telemetry",
    kinds: [
      "hud-badge",
      "hud-gauge",
      "hud-sparkline",
      "hud-counter",
      "hud-crosshairs",
      "hud-swatch",
      "hud-bounding-box"
    ]
  }
];

export const ITEM_META: Record<ItemKind, ItemKindMeta> = {
  text: {
    label: "Text",
    Icon: TextIcon,
    description: "Add a text block"
  },
  title: {
    label: "Title",
    Icon: TitleIcon,
    description: "Headline with a timed display window (falls back to the sketch name)"
  },
  meta: {
    label: "Meta",
    Icon: MetaIcon,
    description: "Title, author, date, etc."
  },
  specs: {
    label: "Specs",
    Icon: SpecsIcon,
    description: "Technical overlay of the sketch settings"
  },
  breakdown: {
    label: "Breakdown",
    Icon: BreakdownIcon,
    description: "Step-by-step diff: the sketch stabilizes while each changed parameter is narrated"
  },
  "hud-badge": {
    label: "Badge",
    Icon: BadgeIcon,
    description: "Text line of live values (sketch identity, resolution, fps…)"
  },
  "hud-gauge": {
    label: "Gauge",
    Icon: GaugeIcon,
    description: "Bar readout bound to a live source"
  },
  "hud-sparkline": {
    label: "Sparkline",
    Icon: SparklineIcon,
    description: "Rolling mini-plot of a live source"
  },
  "hud-counter": {
    label: "Counter",
    Icon: CounterIcon,
    description: "Big numeric readout bound to a live source"
  },
  "hud-crosshairs": {
    label: "Crosshairs",
    Icon: CrosshairsIcon,
    description: "Guide lines through a tracked point"
  },
  "hud-swatch": {
    label: "Swatch",
    Icon: SwatchIcon,
    description: "Live colour chip bound to a colour source"
  },
  "hud-bounding-box": {
    label: "Bounding box",
    Icon: BoundingBoxIcon,
    description: "Labelled region-of-interest frame"
  },
  image: {
    label: "Image",
    Icon: ImageIcon,
    description: "Single image"
  },
  "images-stack": {
    label: "Image stack",
    Icon: StackIcon,
    description: "Multiple images"
  },
  background: {
    label: "Background",
    Icon: BgIcon,
    description: "Backdrop / fill"
  },
  sketch: {
    label: "Sketch",
    Icon: SketchIcon,
    description: "Another sketch, running in its own buffer as a layer"
  },
  qrcode: {
    label: "QR code",
    Icon: QrCodeIcon,
    description: "Scannable link to the current URL"
  }
};
