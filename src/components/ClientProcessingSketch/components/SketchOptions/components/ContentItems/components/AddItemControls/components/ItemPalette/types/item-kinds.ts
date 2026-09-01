export type ItemKind =
  | "visual"
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
