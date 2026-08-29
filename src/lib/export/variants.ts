import {
  FRAMERATE_DEFAULT, resolveAnimation
} from "@/lib/animationConfig";
import {
  getEffectiveSlideSettings
} from "@/lib/effectiveSlideSettings";
import type {
  RecordingFormat
} from "@/engines/recording";
import type {
  SketchOption
} from "@/types/sketch.types";

/**
 * What one export variant produces.
 *
 * `video`  — a recording of the loop, encoded to `format`.
 * `image`  — a single PNG of the current frame.
 * `frames` — a sequence of evenly-sampled PNGs, bundled in a `.zip`.
 */
export type ExportVariantKind = "video" | "image" | "frames";

/** A fixed number of evenly-sampled frames, or every frame of the loop. */
export type ExportFrameCount = number | "all";

export type ExportSize = {
  width: number;
  height: number;
};

/** Which slides a variant covers. An explicit array is a hand-picked subset. */
export type ExportSlideScope = "current" | "all" | number[];

/**
 * How a multi-slide video variant is handed back.
 *
 * `separate` — one file per slide, bundled in a `.zip`.
 * `combined` — every slide captured into ONE encoder, so the result is a
 *   single continuous file. Requires one uniform canvas size for the whole
 *   run (the encoder snapshots its dimensions once) — see `sizeStrategy`.
 */
export type ExportDelivery = "separate" | "combined";

/**
 * How to reconcile slides that carry different `size` overrides.
 *
 * Only consulted when the variant has no explicit `size` of its own — an
 * explicit resolution already forces every slide to one size, so there is
 * nothing to reconcile.
 */
export type ExportSizeStrategy = "smallest" | "biggest" | "root";

export type ExportVariant = {
  id: string;
  /** Shown in the list and used as the filename slug. */
  name: string;
  kind: ExportVariantKind;
  /**
   * The resolution to render at. `null` means "the sketch's own size", i.e.
   * whatever the slide/root options already say.
   *
   * An explicit size wins over per-slide `size` overrides for the whole run:
   * a Reel variant renders every slide at 1080x1920, which is the point.
   */
  size: ExportSize | null;
  /** Capture framerate. `null` means the sketch's native rate. Never above it. */
  framerate: number | null;
  /** Video only. */
  format: RecordingFormat;
  /** Frames only. */
  frameCount: ExportFrameCount;
  slides: ExportSlideScope;
  /** Multi-slide video only. */
  delivery: ExportDelivery;
  sizeStrategy: ExportSizeStrategy;
};

export type ExportVariantPreset = {
  key: string;
  label: string;
  /** Absent for the "current canvas" preset, which reads the live options. */
  size?: ExportSize;
  kind?: ExportVariantKind;
};

/**
 * The add-menu. Deliberately the sizes people actually ship to, in the order
 * they are reached for — a blank variant needing four fields filled in is not
 * a useful starting point.
 */
export const VARIANT_PRESETS: ReadonlyArray<ExportVariantPreset> = [
  {
    key: "reel",
    label: "Instagram Reel",
    size: {
      width: 1080,
      height: 1920
    }
  },
  {
    key: "post",
    label: "Instagram post",
    size: {
      width: 1080,
      height: 1350
    }
  },
  {
    key: "square",
    label: "Square",
    size: {
      width: 1080,
      height: 1080
    }
  },
  {
    key: "landscape",
    label: "Landscape 16:9",
    size: {
      width: 1920,
      height: 1080
    }
  },
  {
    key: "current",
    label: "Current canvas"
  },
  {
    key: "still",
    label: "Still image",
    kind: "image"
  }
];

/**
 * The framerates offered for a variant: the shared preset ladder, capped at
 * the sketch's native rate.
 *
 * Capture is a resample of the sketch's own loop, so asking for more frames
 * per second than the sketch renders would only duplicate them — no extra
 * detail, a bigger file. Those rates are absent rather than offered with a
 * warning attached.
 */
export const FRAMERATE_LADDER: ReadonlyArray<number> = [
  1,
  5,
  10,
  24,
  25,
  30,
  48,
  50,
  60,
  120,
  240
];

export function framerateOptionsFor( nativeFramerate: number ): number[] {
  const options = FRAMERATE_LADDER.filter( ( rate ) => rate <= nativeFramerate );

  // A native rate that is not on the ladder (a hand-typed 45) would otherwise
  // be unreachable — it is always a valid choice for its own sketch.
  return options.includes( nativeFramerate )
    ? options
    : [
      ...options,
      nativeFramerate
    ].sort( (
      a, b
    ) => a - b );
}

/** The sketch's native framerate for the given slide, via the shared resolver. */
export function nativeFramerateFor(
  options: SketchOption,
  slideIndex?: number
): number {
  const {
    animation
  } = getEffectiveSlideSettings(
    options,
    slideIndex
  );

  return resolveAnimation( animation ).framerate;
}

/** The sketch's own canvas size for the given slide. */
export function nativeSizeFor(
  options: SketchOption,
  slideIndex?: number
): ExportSize {
  const {
    size
  } = getEffectiveSlideSettings(
    options,
    slideIndex
  );

  return {
    width: size.width,
    height: size.height
  };
}

function makeId(): string {
  return `variant-${ Math.random().toString( 36 )
    .slice(
      2,
      10
    ) }`;
}

/**
 * Build a variant from a preset, reading the live sketch options for the
 * fields a preset does not pin (the "current canvas" size, the native
 * framerate).
 */
export function makeVariant(
  preset: ExportVariantPreset,
  options: SketchOption,
  slideIndex?: number
): ExportVariant {
  const kind = preset.kind ?? "video";
  const size = preset.size ?? nativeSizeFor(
    options,
    slideIndex
  );

  return {
    id: makeId(),
    name: preset.label,
    kind,
    // The "current canvas" preset pins the size it resolved to rather than
    // staying null: the user picked a concrete format, and a later change to
    // the sketch's canvas must not silently retarget an existing variant.
    size,
    framerate: null,
    format: "mp4",
    frameCount: 10,
    slides: "current",
    delivery: "separate",
    sizeStrategy: "smallest"
  };
}

/** Copy a variant under a new id, so it can be tweaked independently. */
export function duplicateVariant( variant: ExportVariant ): ExportVariant {
  return {
    ...variant,
    id: makeId(),
    name: `${ variant.name } copy`,
    size: variant.size ? {
      ...variant.size
    } : null,
    slides: Array.isArray( variant.slides )
      ? [
        ...variant.slides
      ]
      : variant.slides
  };
}

/**
 * The slide indices a variant covers, in order.
 *
 * A sketch with no slides has no slide dimension at all: every scope collapses
 * to `[ undefined ]`, meaning "render the sketch as-is".
 */
export function resolveSlideIndices(
  variant: ExportVariant,
  slideCount: number,
  activeSlideIndex: number | undefined
): Array<number | undefined> {
  if ( slideCount === 0 ) {
    return [
      undefined
    ];
  }

  if ( variant.slides === "all" ) {
    return Array.from(
      {
        length: slideCount
      },
      (
        _unused, index
      ) => index
    );
  }

  if ( Array.isArray( variant.slides ) ) {
    const picked = variant.slides
      .filter( ( index ) => index >= 0 && index < slideCount )
      .sort( (
        a, b
      ) => a - b );

    return picked.length > 0
      ? picked
      : [
        activeSlideIndex ?? 0
      ];
  }

  return [
    activeSlideIndex ?? 0
  ];
}

/**
 * The one size a run renders at, or `null` when the variant follows each
 * slide's own size and they agree anyway.
 *
 * Only a `combined` delivery truly needs a single answer (one encoder, one set
 * of dimensions). `separate` may legitimately return null and let each slide
 * keep its own size.
 */
export function resolveRunSize(
  variant: ExportVariant,
  options: SketchOption,
  slideIndices: Array<number | undefined>
): ExportSize | null {
  if ( variant.size ) {
    return variant.size;
  }

  const sizes = slideIndices.map( ( index ) => nativeSizeFor(
    options,
    index
  ) );

  if ( sizes.length === 0 ) {
    return null;
  }

  const allEqual = sizes.every( ( size ) =>
    size.width === sizes[ 0 ].width && size.height === sizes[ 0 ].height );

  if ( allEqual ) {
    return sizes[ 0 ];
  }

  if ( variant.sizeStrategy === "root" ) {
    const {
      size
    } = getEffectiveSlideSettings( options );

    return {
      width: size.width,
      height: size.height
    };
  }

  const byArea = [
    ...sizes
  ].sort( (
    a, b
  ) => a.width * a.height - b.width * b.height );

  return variant.sizeStrategy === "biggest"
    ? byArea[ byArea.length - 1 ]
    : byArea[ 0 ];
}

/** True when the selected slides disagree on canvas size. */
export function hasMixedSlideSizes(
  variant: ExportVariant,
  options: SketchOption,
  slideIndices: Array<number | undefined>
): boolean {
  if ( variant.size || slideIndices.length < 2 ) {
    return false;
  }

  const sizes = slideIndices.map( ( index ) => nativeSizeFor(
    options,
    index
  ) );

  return !sizes.every( ( size ) =>
    size.width === sizes[ 0 ].width && size.height === sizes[ 0 ].height );
}

/** File extension a variant's output carries, before any zip wrapping. */
export function variantExtension( variant: ExportVariant ): string {
  if ( variant.kind === "image" ) {
    return "png";
  }

  if ( variant.kind === "frames" ) {
    return "zip";
  }

  return variant.format;
}

/** Lowercase, filename-safe form of a variant name. */
export function slugify( value: string ): string {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}

/**
 * The filename a variant's download carries.
 *
 * Follows the convention the recorder paths already established —
 * `<sketch>-<slug>-<width>x<height>.<ext>` — so an export dropped in a folder
 * says what it is without being opened.
 */
export function variantFileName(
  variant: ExportVariant,
  sketchName: string,
  size: ExportSize,
  options: {
    bundled?: boolean;
    slideIndex?: number;
  } = {}
): string {
  const safeName = slugify( sketchName ) || "sketch";
  const slug = slugify( variant.name );
  const dimensions = `${ size.width }x${ size.height }`;
  const slide = options.slideIndex === undefined
    ? ""
    : `-slide-${ options.slideIndex + 1 }`;
  const extension = options.bundled ? "zip" : variantExtension( variant );
  const parts = [
    safeName,
    slug,
    dimensions
  ].filter( Boolean );

  return `${ parts.join( "-" ) }${ slide }.${ extension }`;
}

export {
  FRAMERATE_DEFAULT
};
