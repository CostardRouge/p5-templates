import string from "../../string.js";
import animation from "../../animation.js";
import sketch, {
  getP5
} from "../../sketch.js";
import {
  reportItemPartBounds
} from "../../slides/common/itemBoundsRegistry.js";

export const FALLBACK_FILL = [
  0,
  255,
  120,
  255
];

/**
 * Resolve a font key to a loaded p5 font, falling back to space mono.
 */
export function getFont( fontKey ) {
  return string.fonts?.[ fontKey ] ?? string.fonts.spaceMonoRegular;
}

/**
 * Build a p5.Color from an rgb/rgba array (or fall back), with optional alpha.
 */
export function toColor(
  p, value, fallback = FALLBACK_FILL, alpha
) {
  const arr = Array.isArray( value ) ? value : fallback;
  const color = p.color( ...arr );

  if ( typeof alpha === "number" ) {
    color.setAlpha( alpha );
  }

  return color;
}

/**
 * Absolute position + text alignment from an anchor + fractional offset.
 * `offset` is an absolute position on the canvas (x, y in 0..1); `anchor`
 * only controls which corner of the content aligns to that point.
 */
export function resolveAnchor(
  p, anchor = "top-left", offset = {
    x: 0.05,
    y: 0.06
  }
) {
  const x = ( offset?.x ?? 0 ) * p.width;
  const y = ( offset?.y ?? 0 ) * p.height;

  const align = {
    "top-left": [
      p.LEFT,
      p.TOP
    ],
    "top-right": [
      p.RIGHT,
      p.TOP
    ],
    "bottom-left": [
      p.LEFT,
      p.BOTTOM
    ],
    "bottom-right": [
      p.RIGHT,
      p.BOTTOM
    ],
    center: [
      p.CENTER,
      p.CENTER
    ]
  }[ anchor ] ?? [
    p.LEFT,
    p.TOP
  ];

  return {
    x,
    y,
    align,
    anchorX: align[ 0 ],
    anchorY: align[ 1 ]
  };
}

/**
 * Resolve the top-left corner of a fixed-size block (label + bar/plot) given an
 * anchor + fractional offset, so right/bottom/center anchors lay the block out
 * away from the anchored edge.
 */
export function resolveBlock(
  p, anchor, offset, blockW, blockH
) {
  const {
    x,
    y,
    anchorX,
    anchorY
  } = resolveAnchor(
    p,
    anchor,
    offset
  );

  const blockX =
    anchorX === p.RIGHT
      ? x - blockW
      : anchorX === p.CENTER
        ? x - blockW / 2
        : x;
  const blockY =
    anchorY === p.BOTTOM
      ? y - blockH
      : anchorY === p.CENTER
        ? y - blockH / 2
        : y;

  return {
    blockX,
    blockY,
    anchorX,
    anchorY
  };
}

/**
 * Top-left rectangle of an align-anchored block of size w×h whose align corner
 * sits at (x, y) — the same corner→top-left conversion resolveBlock does, but
 * from an already-resolved anchor point + alignment (used by the text widgets
 * that lay out with resolveAnchor rather than resolveBlock).
 */
export function anchoredRect(
  p, x, y, align, w, h
) {
  const [
    anchorX,
    anchorY
  ] = align;
  const rectX =
    anchorX === p.RIGHT
      ? x - w
      : anchorX === p.CENTER
        ? x - w / 2
        : x;
  const rectY =
    anchorY === p.BOTTOM
      ? y - h
      : anchorY === p.CENTER
        ? y - h / 2
        : y;

  return {
    x: rectX,
    y: rectY,
    w,
    h
  };
}

/**
 * Report a widget's drawn rectangle (canvas pixels) under its HUD sub-key, so
 * the on-canvas content drag can grab and move that one widget by its visible
 * body. `part` is the widget key (badge, gauge, sparkline, counter, swatch);
 * a no-op outside a content-item bounds bracket (see itemBoundsRegistry).
 */
export function reportWidgetBounds(
  part, x, y, w, h
) {
  reportItemPartBounds(
    part,
    x,
    y,
    w,
    h
  );
}

/**
 * Whether the widget is within its display window (gated on progression,
 * mirroring the title overlay's displayFrom/displayTo).
 */
export function withinWindow( cfg ) {
  const from = cfg.displayFrom ?? 0;
  const to = cfg.displayTo ?? 1;
  const progress = animation.progression;

  return progress >= from && progress <= to;
}

/**
 * Run a widget's drawing inside an isolated push/pop, shifting the origin to
 * the top-left for WebGL sketches so every widget can use plain (0..width,
 * 0..height) canvas coordinates — exactly like drawSlideSpecs does.
 */
export function withHudTransform( cb ) {
  const p = getP5();

  p.push();

  if ( sketch.sketchOptions?.type === "webgl" ) {
    p.translate(
      -p.width / 2,
      -p.height / 2
    );
  }

  cb( p );

  p.pop();
  p.blendMode( p.BLEND );
}

/**
 * Format a numeric value with optional decimals + unit suffix.
 */
export function formatValue(
  value, decimals = 0, unit = ""
) {
  if ( typeof value !== "number" || !Number.isFinite( value ) ) {
    return `${ value ?? "—" }${ unit ? ` ${ unit }` : "" }`;
  }

  const factor = Math.pow(
    10,
    decimals
  );
  const rounded = Math.round( value * factor ) / factor;

  return `${ rounded.toFixed( decimals ) }${ unit ? ` ${ unit }` : "" }`;
}

/**
 * Convert an rgb/rgba array to an uppercase hex string (#RRGGBB).
 * Deterministic — no p5 color object required.
 */
export function toHex( value ) {
  if ( !Array.isArray( value ) ) {
    return "#------";
  }

  const channel = ( n ) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round( n ?? 0 )
      )
    )
      .toString( 16 )
      .padStart(
        2,
        "0"
      );

  return `#${ channel( value[ 0 ] ) }${ channel( value[ 1 ] ) }${ channel( value[ 2 ] ) }`.toUpperCase();
}
