// ── Plates: the colour ground of a splash, a loader or a plate scene ────────
//
// A plate is two colours — the scene's own, or two points of a shared palette
// ramp (utils/palettes.js) — laid as a gradient that can travel over the
// scene's time, under an optional static grain. Painted with the Canvas2D
// gradient API straight onto the scene's P2D buffer: a full-frame gradient per
// frame costs nothing there, and it keeps p5's own state out of the way.
//
// Colour sampling is CPU-side and shared with the compositor's ramp upload
// (`paletteRamp`), so a transition's edge light and a plate picked from the
// same palette are the same colours.

import {
  paletteSampler, shaderPalette
} from "../palettes.js";

const TAU = Math.PI * 2;

/** The value of a plate's / transition's `palette` meaning "use the colours". */
const OWN_COLOURS = "color";

function toRgb( value ) {
  return Array.isArray( value )
    ? [
      Number( value[ 0 ] ) || 0,
      Number( value[ 1 ] ) || 0,
      Number( value[ 2 ] ) || 0
    ]
    : [
      0,
      0,
      0
    ];
}

export function cssColor(
  rgb, alpha = 1
) {
  return `rgba(${ Math.round( rgb[ 0 ] ) }, ${ Math.round( rgb[ 1 ] ) }, ${ Math.round( rgb[ 2 ] ) }, ${ alpha })`;
}

/**
 * A palette id's sampler, or null when the id means "own colours" (or is
 * unknown — a stale saved id draws the colours rather than nothing).
 */
export function paletteSamplerFor( id ) {
  if ( !id || id === OWN_COLOURS ) {
    return null;
  }

  return paletteSampler( id );
}

const ramps = new Map();

/**
 * The baked 256 × 1 ramp of a palette id for the compositor's `uRamp`, keyed
 * so the texture is uploaded once per id; null for the own-colours value.
 */
export function paletteRamp( id ) {
  if ( !id || id === OWN_COLOURS ) {
    return null;
  }

  if ( ramps.has( id ) ) {
    return ramps.get( id );
  }

  const {
    textures, uniforms
  } = shaderPalette( {
    palette: id
  } );
  const ramp = uniforms.uPaletteOn
    ? {
      key: id,
      data: textures.uPaletteRamp.data,
      width: textures.uPaletteRamp.width,
      height: textures.uPaletteRamp.height ?? 1
    }
    : null;

  ramps.set(
    id,
    ramp
  );

  return ramp;
}

/**
 * The two colours a plate shows at scene progress `t`: its own `from` / `to`,
 * or two points of its palette's ramp half a turn apart, slid along the ramp
 * by the drift — so a palette plate changes colour over the scene.
 *
 * @returns {{ from: number[], to: number[], accent: number[] }} 0–255 rgb
 */
export function plateColors(
  plate, t = 0
) {
  const sample = paletteSamplerFor( plate?.palette );

  if ( sample ) {
    const drift = Number( plate?.drift ) || 0;
    const x = t * drift * 0.5;
    const from = sample( x );
    const to = sample( x + 0.45 );

    return {
      from,
      to,
      accent: sample( x + 0.7 )
    };
  }

  const from = toRgb( plate?.from );
  const to = toRgb( plate?.to );

  return {
    from,
    to,
    accent: to
  };
}

// A seeded grain tile, built once: the same noise on every frame and every
// machine, so a captured plate does not boil (see sketches.md on decorative
// noise).
let grainTile = null;

function getGrainTile() {
  if ( grainTile || typeof document === "undefined" ) {
    return grainTile;
  }

  const size = 128;
  const canvas = document.createElement( "canvas" );

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext( "2d" );

  if ( !ctx ) {
    return null;
  }

  const image = ctx.createImageData(
    size,
    size
  );
  let seed = 1337;

  for ( let i = 0; i < image.data.length; i += 4 ) {
    seed = ( seed * 1664525 + 1013904223 ) >>> 0;

    const v = ( seed >>> 8 ) & 255;

    image.data[ i ] = v;
    image.data[ i + 1 ] = v;
    image.data[ i + 2 ] = v;
    image.data[ i + 3 ] = 255;
  }

  ctx.putImageData(
    image,
    0,
    0
  );
  grainTile = canvas;

  return grainTile;
}

const grainPatterns = new WeakMap();

function grainPattern( ctx ) {
  let pattern = grainPatterns.get( ctx );

  if ( pattern === undefined ) {
    const tile = getGrainTile();

    pattern = tile ? ctx.createPattern(
      tile,
      "repeat"
    ) : null;
    grainPatterns.set(
      ctx,
      pattern
    );
  }

  return pattern;
}

/**
 * Fill `width` × `height` of `g` (a P2D p5.Graphics, already transformed to
 * layout units) with the plate at scene progress `t`.
 */
export function paintPlate(
  g, plate, width, height, t = 0
) {
  const ctx = g.drawingContext;

  if ( !ctx ) {
    return;
  }

  const {
    from, to
  } = plateColors(
    plate,
    t
  );
  const gradient = plate?.gradient ?? "linear";
  const angle = ( ( Number( plate?.angle ) || 0 ) * Math.PI ) / 180;
  const drift = Number( plate?.drift ) || 0;
  const cx = width / 2;
  const cy = height / 2;
  const reach = Math.hypot(
    width,
    height
  ) / 2;

  ctx.save();

  if ( gradient === "solid" ) {
    ctx.fillStyle = cssColor( from );
  } else if ( gradient === "radial" ) {
    // The focus wanders along the plate's angle as the scene plays.
    const wander = drift * t * reach * 0.4;
    const fx = cx + Math.cos( angle ) * wander;
    const fy = cy + Math.sin( angle ) * wander;
    const radial = ctx.createRadialGradient(
      fx,
      fy,
      0,
      cx,
      cy,
      reach
    );

    radial.addColorStop(
      0,
      cssColor( from )
    );
    radial.addColorStop(
      1,
      cssColor( to )
    );
    ctx.fillStyle = radial;
  } else if ( gradient === "conic" && typeof ctx.createConicGradient === "function" ) {
    const conic = ctx.createConicGradient(
      angle + drift * t * TAU,
      cx,
      cy
    );

    conic.addColorStop(
      0,
      cssColor( from )
    );
    conic.addColorStop(
      0.5,
      cssColor( to )
    );
    conic.addColorStop(
      1,
      cssColor( from )
    );
    ctx.fillStyle = conic;
  } else if ( gradient === "stripes" ) {
    ctx.fillStyle = cssColor( from );
    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    const stripes = 14;
    const span = reach * 2;
    const stripe = span / stripes;
    const shift = drift * t * stripe * 2;

    ctx.translate(
      cx,
      cy
    );
    ctx.rotate( angle );
    ctx.fillStyle = cssColor( to );

    for ( let i = -1; i <= stripes; i += 2 ) {
      ctx.fillRect(
        -span / 2 + i * stripe + shift,
        -span,
        stripe,
        span * 2
      );
    }

    ctx.restore();
    ctx.save();
  } else {
    // Linear: the gradient line slides along itself by the drift.
    const dx = Math.cos( angle ) * reach;
    const dy = Math.sin( angle ) * reach;
    const slide = drift * t * 0.6;
    const linear = ctx.createLinearGradient(
      cx - dx * ( 1 + slide ),
      cy - dy * ( 1 + slide ),
      cx + dx * ( 1 - slide ),
      cy + dy * ( 1 - slide )
    );

    linear.addColorStop(
      0,
      cssColor( from )
    );
    linear.addColorStop(
      1,
      cssColor( to )
    );
    ctx.fillStyle = linear;
  }

  if ( gradient !== "stripes" ) {
    ctx.fillRect(
      0,
      0,
      width,
      height
    );
  }

  const grain = Number( plate?.grain ) || 0;

  if ( grain > 0 ) {
    const pattern = grainPattern( ctx );

    if ( pattern ) {
      ctx.globalAlpha = grain * 0.35;
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = pattern;
      ctx.fillRect(
        0,
        0,
        width,
        height
      );
    }
  }

  ctx.restore();
}
