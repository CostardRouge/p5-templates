export type ItemKind = "text" | "meta" | "image" | "images-stack" | "background";

export type ItemKindMeta = {
  label: string;
  Icon: React.ComponentType<{
    className?: string; strokeWidth?:
      number
  }>;
  description?: string;
};