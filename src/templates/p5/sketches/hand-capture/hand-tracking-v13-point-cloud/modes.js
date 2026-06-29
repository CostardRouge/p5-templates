import mappers from "@/p5/utils/mappers.js";

// ── Depth modes for video-point-cloud ───────────────────────────────────────
// Every mode fills `ctx.target` (a Float32Array, one entry per grid cell) with a
// NORMALISED depth in [0, 1] — 0 = deepest / furthest, 1 = closest. The shared
// post-processing in index.js then applies invert → easing → near/far mapping,
// so a mode never has to know about world units. Cells outside the silhouette
// mask are skipped by the caller, so a mode may leave anything in those slots.
//
// The context handed to each compute() is:
//   { columns, rows, value, mask, target, params, state, p, time, noiseTime }
//     value     Float32Array — perceived channel value per cell, in [0, 1]
//     mask      Uint8Array    — 1 where the cell sits inside the silhouette
//     target    Float32Array  — output buffer to fill
//     params    object        — this mode's option sub-tree
//     state     object        — persistent per-mode scratch (survives frames)
//     time      number        — elapsed seconds (sketch clock)
//     noiseTime number        — animation.angle, for Perlin progression

// Perceived value of a pixel on the chosen channel, normalised to [0, 1].
export function channelValue(
  r, g, b, channel
) {
  if ( channel === "red" ) {
    return r / 255;
  }

  if ( channel === "green" ) {
    return g / 255;
  }

  if ( channel === "blue" ) {
    return b / 255;
  }

  if ( channel === "saturation" ) {
    const max = Math.max(
      r,
      g,
      b
    );
    const min = Math.min(
      r,
      g,
      b
    );

    return max === 0 ? 0 : ( max - min ) / max;
  }

  if ( channel === "hue" ) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(
      rr,
      gg,
      bb
    );
    const min = Math.min(
      rr,
      gg,
      bb
    );
    const delta = max - min;

    if ( delta === 0 ) {
      return 0;
    }

    let hue;

    if ( max === rr ) {
      hue = ( ( gg - bb ) / delta ) % 6;
    } else if ( max === gg ) {
      hue = ( bb - rr ) / delta + 2;
    } else {
      hue = ( rr - gg ) / delta + 4;
    }

    hue /= 6;

    return hue < 0 ? hue + 1 : hue;
  }

  // Default: Rec. 601 luminance.
  return ( 0.299 * r + 0.587 * g + 0.114 * b ) / 255;
}

// ── color: depth from the perceived value of each pixel ──────────────────────
// The headline mode. The spread is RELATIVE by default — remapped against the
// min/max actually present in the frame (temporally smoothed so it does not
// flicker), not against the absolute 0–255 range — so a flatly-lit subject
// still gets the full depth range.
function computeColor( ctx ) {
  const {
    value, mask, target, params
  } = ctx;
  const normalization = params.normalization ?? "relative";

  let low = 0;
  let high = 1;

  if ( normalization === "relative" ) {
    let frameMin = Infinity;
    let frameMax = -Infinity;

    for ( let i = 0; i < value.length; i++ ) {
      if ( !mask[ i ] ) {
        continue;
      }

      const v = value[ i ];

      if ( v < frameMin ) {
        frameMin = v;
      }

      if ( v > frameMax ) {
        frameMax = v;
      }
    }

    if ( frameMin === Infinity ) {
      frameMin = 0;
      frameMax = 1;
    }

    const smoothing = params.rangeSmoothing ?? 0.1;

    low = mappers.smoother(
      "vpc-color-low",
      frameMin,
      smoothing
    );
    high = mappers.smoother(
      "vpc-color-high",
      frameMax,
      smoothing
    );
  } else if ( normalization === "fixed" ) {
    low = params.fixedLow ?? 0;
    high = params.fixedHigh ?? 1;
  }

  const span = ( high - low ) || 1e-6;

  for ( let i = 0; i < target.length; i++ ) {
    if ( !mask[ i ] ) {
      target[ i ] = 0;
      continue;
    }

    const depth = ( value[ i ] - low ) / span;

    target[ i ] = depth < 0 ? 0 : depth > 1 ? 1 : depth;
  }
}

// ── wave: animated sinusoidal ripple across the silhouette ───────────────────
function computeWave( ctx ) {
  const {
    columns, rows, target, params, p, time
  } = ctx;
  const freqX = params.freqX ?? 3;
  const freqY = params.freqY ?? 3;
  const speed = params.speed ?? 1;
  const amplitude = params.amplitude ?? 1;
  const tau = p.TAU;

  for ( let cy = 0; cy < rows; cy++ ) {
    const v = rows > 1 ? cy / ( rows - 1 ) : 0;

    for ( let cx = 0; cx < columns; cx++ ) {
      const u = columns > 1 ? cx / ( columns - 1 ) : 0;
      const wave = Math.sin( u * freqX * tau + v * freqY * tau + time * speed );

      target[ cy * columns + cx ] = 0.5 + 0.5 * amplitude * wave;
    }
  }
}

// ── perlin: animated Perlin-noise field (organic, random-looking relief) ─────
function computePerlin( ctx ) {
  const {
    columns, rows, target, params, p, noiseTime
  } = ctx;
  const scale = params.scale ?? 2;
  const speed = params.speed ?? 0.3;
  const t = noiseTime * speed;

  for ( let cy = 0; cy < rows; cy++ ) {
    const v = rows > 1 ? cy / ( rows - 1 ) : 0;

    for ( let cx = 0; cx < columns; cx++ ) {
      const u = columns > 1 ? cx / ( columns - 1 ) : 0;

      target[ cy * columns + cx ] = p.noise(
        u * scale,
        v * scale,
        t
      );
    }
  }
}

// ── motion: flat at rest, pixels that move pop in/out of depth ───────────────
// Frame-differencing the perceived value. The displacement ACCUMULATES on
// movement and decays back to the flat mid-plane (0.5) when the subject holds
// still — exactly the "move and the points push forward" behaviour.
function computeMotion( ctx ) {
  const {
    value, mask, target, params, state
  } = ctx;
  const n = value.length;

  if ( !state.prev || state.prev.length !== n ) {
    state.prev = new Float32Array( n );
    state.accum = new Float32Array( n );
    state.prev.set( value );
  }

  const gain = params.gain ?? 6;
  const threshold = params.threshold ?? 0.04;
  const decay = params.decay ?? 0.9;
  const direction = params.direction === "backward" ? -1 : 1;
  const prev = state.prev;
  const accum = state.accum;

  for ( let i = 0; i < n; i++ ) {
    let delta = Math.abs( value[ i ] - prev[ i ] ) - threshold;

    if ( delta < 0 ) {
      delta = 0;
    }

    let pushed = Math.max(
      delta * gain,
      accum[ i ] * decay
    );

    if ( pushed > 1 ) {
      pushed = 1;
    }

    accum[ i ] = pushed;
    prev[ i ] = value[ i ];

    // Rest → 0.5 (a flat plane); movement pushes toward the chosen direction.
    target[ i ] = mask[ i ] ? 0.5 + direction * 0.5 * pushed : 0.5;
  }
}

export const MODES = {
  color: {
    id: "color",
    label: "Couleur → profondeur",
    compute: computeColor
  },
  wave: {
    id: "wave",
    label: "Vague / ondulation",
    compute: computeWave
  },
  perlin: {
    id: "perlin",
    label: "Aléatoire / Perlin",
    compute: computePerlin
  },
  motion: {
    id: "motion",
    label: "Mouvement",
    compute: computeMotion
  }
};

export const MODE_IDS = Object.keys( MODES );

export function computeDepth(
  modeId, ctx
) {
  const mode = MODES[ modeId ] ?? MODES.color;

  mode.compute( ctx );

  return ctx.target;
}
