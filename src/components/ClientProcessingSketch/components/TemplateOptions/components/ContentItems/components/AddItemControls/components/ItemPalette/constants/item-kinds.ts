import {
  Type as TextIcon, Info as MetaIcon, Image as ImageIcon, Layers as StackIcon, PaintBucket as BgIcon
} from "lucide-react";
import {
  ItemKind, ItemKindMeta
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";

export const ITEM_ORDER: ItemKind[] = [
  "text",
  "image",
  "images-stack",
  "meta",
  "background"
];

export const ITEM_META: Record<ItemKind, ItemKindMeta> = {
  text: {
    label: "Text",
    Icon: TextIcon,
    description: "Add a text block"
  },
  meta: {
    label: "Meta",
    Icon: MetaIcon,
    description: "Title, author, date, etc."
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
};