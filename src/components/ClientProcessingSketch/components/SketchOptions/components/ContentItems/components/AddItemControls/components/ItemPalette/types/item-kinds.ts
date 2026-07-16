export type ItemKind =
  | "visual"
  | "text"
  | "title"
  | "meta"
  | "specs"
  | "breakdown"
  | "hud"
  | "image"
  | "images-stack"
  | "background"
  | "qrcode";

export type ItemKindMeta = {
  label: string;
  Icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
  }>;
  description?: string;
};
