import {
  Type as TextIcon,
  Heading as TitleIcon,
  Info as MetaIcon,
  Image as ImageIcon,
  Layers as StackIcon,
  PaintBucket as BgIcon,
  Sparkles as VisualIcon,
  Terminal as SpecsIcon,
  QrCode as QrCodeIcon,
  Gauge as HudIcon
} from "lucide-react";
import {
  ItemKind,
  ItemKindMeta
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";

export const ITEM_ORDER: ItemKind[] = [
  "visual",
  "text",
  "title",
  "image",
  "images-stack",
  "meta",
  "specs",
  "hud",
  "background",
  "qrcode"
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
  hud: {
    label: "HUD",
    Icon: HudIcon,
    description: "Telemetry widgets (gauge, sparkline, badge…)"
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
  visual: {
    label: "Visual",
    Icon: VisualIcon,
    description: "2D/3D visual"
  },
  qrcode: {
    label: "QR code",
    Icon: QrCodeIcon,
    description: "Scannable link to the current URL"
  }
};
