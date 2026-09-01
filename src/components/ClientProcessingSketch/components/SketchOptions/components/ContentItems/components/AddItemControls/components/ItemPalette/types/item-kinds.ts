export type ItemKind =
  | "sketch"
  | "text"
  | "title"
  | "meta"
  | "specs"
  | "breakdown"
  | "hud-badge"
  | "hud-gauge"
  | "hud-sparkline"
  | "hud-counter"
  | "hud-crosshairs"
  | "hud-swatch"
  | "hud-bounding-box"
  | "image"
  | "images-stack"
  | "background"
  | "qrcode";

/**
 * Adding a layer, optionally pre-filled.
 *
 * The seed exists because one kind cannot be added blind: an embedded-sketch
 * layer with no sketch chosen renders nothing, so its palette tile picks first
 * and hands the choice (and that sketch's own defaults) through here.
 */
export type AddItemHandler = (
  kind: ItemKind,
  seed?: Record<string, unknown>
) => void;

export type ItemKindGroup = {
  label: string;
  kinds: ItemKind[];
};

export type ItemKindMeta = {
  label: string;
  Icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
  }>;
  description?: string;
};
