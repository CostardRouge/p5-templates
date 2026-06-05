import type {
  ComponentType, ReactNode
} from "react";

/** Whether the asset belongs to the sketch globally or to a specific slide. */
export type AssetScope =
  | "global"
  | { slide: number };

/**
 * A field-level reference to an asset. The `path` is the storage key (S3
 * or local blob), `params` is whatever per-instance configuration the kind
 * defines (e.g. video time-stretch). For kinds without params, `params`
 * is an empty object.
 *
 * Different fields can reference the same `path` with different `params`,
 * so each entry carries its own stable `id`.
 */
export type AssetInstance<P = unknown> = {
  id: string;
  path: string;
  params: P;
};

/**
 * Descriptor for a single asset family (images, videos, audios, json, …).
 * Adding a new family is one descriptor + a `registerAssetKind` call —
 * no UI or hook changes elsewhere.
 */
export type AssetKind<P = unknown> = {
  /** Stable identifier used in storage paths and field configs. */
  id: string;
  /** Human label shown in pickers and section headers. */
  label: string;
  /** `accept` attribute for `<input type="file">`. */
  accept: string;
  /** Whether this kind exposes per-instance parameters in the UI. */
  hasParams: boolean;
  /** Factory for the parameter object given to a newly added instance. */
  defaultParams: () => P;

  /**
   * Normalize a raw entry coming from form state into an `AssetInstance`.
   * Must accept both the canonical shape AND legacy string-only paths so
   * existing data keeps working after a kind gains parameters.
   */
  parseFieldEntry( raw: unknown, makeId: () => string ): AssetInstance<P>;

  /**
   * Convert an `AssetInstance` to the shape persisted in form state.
   * Path-only kinds (images) should return the path string for backward
   * compatibility; kinds with params should return the full instance.
   */
  serializeFieldEntry( instance: AssetInstance<P> ): unknown;

  /** Square thumbnail rendered in stacks and single-asset inputs. */
  PreviewComponent: ComponentType<AssetPreviewProps>;

  /**
   * Optional params-aware preview shown in the asset dialog instead of the
   * plain {@link PreviewComponent}. Lets a kind reflect its parameters in the
   * preview — e.g. a video drawn at its configured scale/position inside a
   * box matching the canvas aspect ratio. Falls back to `PreviewComponent`.
   */
  LayoutPreviewComponent?: ComponentType<AssetLayoutPreviewProps<P>>;

  /** Per-instance parameter editor (popover). Omit for kinds without params. */
  ParamsEditor?: ComponentType<AssetParamsEditorProps<P>>;
};

export type AssetPreviewProps = {
  url: string;
  path: string;
  className?: string;
  children?: ReactNode;
};

export type AssetLayoutPreviewProps<P> = {
  url: string;
  path: string;
  /** Current per-instance params, so the preview can reflect them live. */
  params: P;
  /** width / height of the target canvas, for the preview's aspect ratio. */
  canvasAspectRatio?: number;
  /**
   * Optional write-back so the preview can be interactive — e.g. dragging the
   * video thumbnail to set its position. When omitted the preview is
   * read-only. Mirrors {@link AssetParamsEditorProps.onChange}, so dragging and
   * the params editor stay in sync on the same instance params.
   */
  onParamsChange?: ( params: P ) => void;
};

export type AssetParamsEditorProps<P> = {
  value: P;
  onChange: ( value: P ) => void;
};
