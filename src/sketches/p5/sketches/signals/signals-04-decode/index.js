import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import audio from "@/p5/utils/audio.js";
import string from "@/p5/utils/string.js";
import drawInstrument from "../_instrument.js";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNALS — 04 / DECODE
//
// The revelation piece, and the answer to the rejected "text-morphing" past: the
// instrument decodes a noisy signal into a glyph. A cloud of points starts as
// looping oscilloscope noise, then — as the instrument "locks" — collapses onto
// the sampled outline of a word, drawing neon connecting lines as it resolves,
// holds, and dissolves back into noise. Under the SIGNALS frame this reads not as
// "animated lettering" but as a measurement: SOURCE NOISE → LOCK 100% → glyph.
//
// Self-contained (CPU, P2D) so the loop is fully deterministic: the scatter state
// is noise sampled on a circle of progression (seamless), and the morph envelope
// is 0 at both ends of the loop, so uTime 0 == uTime 1.
// ─────────────────────────────────────────────────────────────────────────────

let lastLocked = false;

/** Low-saturation iridescent colour (shared palette language of the series). */
function iridescent(
  p, t, saturation
) {
  const r = 0.5 + 0.5 * p.cos( p.TAU * ( t + 0.00 ) );
  const g = 0.5 + 0.5 * p.cos( p.TAU * ( t + 0.33 ) );
  const b = 0.5 + 0.5 * p.cos( p.TAU * ( t + 0.67 ) );
  const lum = 0.30 * r + 0.59 * g + 0.11 * b;

  return [
    ( lum + ( r - lum ) * saturation ) * 255,
    ( lum + ( g - lum ) * saturation ) * 255,
    ( lum + ( b - lum ) * saturation ) * 255
  ];
}

function smoothstep(
  e0, e1, x
) {
  const t = Math.min(
    1,
    Math.max(
      0,
      ( x - e0 ) / ( e1 - e0 )
    )
  );

  return t * t * ( 3 - 2 * t );
}

sketch.setup( () => {} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  const text = ( o.glyph?.text ?? "SIGNAL" ).toUpperCase();
  const sizeFactor = o.glyph?.sizeFactor ?? 0.19;
  const sampleFactor = o.glyph?.sampleFactor ?? 0.18;
  const fontKey = o.glyph?.font ?? "spaceMonoRegular";

  const saturation = o.palette?.saturation ?? 0.28;
  const hueSpread = o.palette?.hueSpread ?? 1.2;
  const dotSize = ( o.render?.dotSize ?? 0.006 ) * p.width;
  const showLines = o.render?.lines ?? true;
  const scatterW = ( o.signal?.scatterWidth ?? 0.85 ) * p.width;
  const scatterH = ( o.signal?.scatterHeight ?? 0.5 ) * p.height;

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  const cx = p.width / 2;
  const cy = p.height / 2;
  const center = p.createVector(
    cx,
    cy
  );
  const font = string.fonts[ fontKey ] ?? string.fonts.spaceMonoRegular;

  // Sampled glyph outline, centred. Empty until the font finishes loading.
  const home = string.getTextPoints( {
    text,
    size: sizeFactor * p.width,
    font,
    position: center,
    sampleFactor
  } );

  // Morph envelope over the loop: 0 (pure noise) → 1 (locked glyph) → 0. Zero at
  // both ends keeps the seamless loop; the flat middle is the "hold".
  const pr = animation.progression;
  const lock = smoothstep(
    0.15,
    0.34,
    pr
  ) * ( 1 - smoothstep(
    0.66,
    0.85,
    pr
  ) );
  const morph = easing.easeInOutCubic( lock );

  // Scatter state: noise sampled on a circle of progression so it loops.
  const a = animation.angle;
  const ca = p.cos( a );
  const sa = p.sin( a );

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  p.push();
  p.blendMode( p.ADD );

  let prev = null;
  let prevHome = null;

  for ( let i = 0; i < home.length; i++ ) {
    const h = home[ i ];

    if ( h.x < minX ) {
      minX = h.x;
    }
    if ( h.x > maxX ) {
      maxX = h.x;
    }
    if ( h.y < minY ) {
      minY = h.y;
    }
    if ( h.y > maxY ) {
      maxY = h.y;
    }

    const sx = cx + ( p.noise(
      i * 0.07 + 10 + ca * 0.5,
      sa * 0.5
    ) - 0.5 ) * scatterW;
    const sy = cy + ( p.noise(
      i * 0.07 + 50 + ca * 0.5,
      30 + sa * 0.5
    ) - 0.5 ) * scatterH;

    const x = sx + ( h.x - sx ) * morph;
    const y = sy + ( h.y - sy ) * morph;

    // Hue is purely spatial (by point index) so the scattered seam frame at
    // pr = 0 and pr = 1 is identical — no colour pop across the loop boundary.
    const hue = ( ( i / home.length ) * hueSpread ) % 1;
    const [
      r,
      g,
      b
    ] = iridescent(
      p,
      hue,
      saturation
    );

    // Connecting lines fade in with the lock, but only along the real outline
    // (skip the big jumps between separate contours / letters).
    if ( showLines && prev && prevHome ) {
      const gap = p.dist(
        h.x,
        h.y,
        prevHome.x,
        prevHome.y
      );

      if ( gap < sizeFactor * p.width * 0.4 ) {
        p.stroke(
          r,
          g,
          b,
          morph * 150
        );
        p.strokeWeight( dotSize * 0.6 );
        p.line(
          prev.x,
          prev.y,
          x,
          y
        );
      }
    }

    p.stroke(
      r,
      g,
      b,
      90 + morph * 140
    );
    p.strokeWeight( dotSize );
    p.point(
      x,
      y
    );

    prev = {
      x,
      y
    };
    prevHome = h;
  }

  p.pop();

  // ── structural instrument frame ─────────────────────────────────────────────
  if ( ( o.hud?.show ?? true ) && home.length ) {
    drawInstrument(
      p,
      {
        box: {
          minX,
          minY,
          maxX,
          maxY
        },
        head: {
          x: cx,
          y: cy
        },
        hudColor: o.hud?.color ?? [
          180,
          230,
          210
        ],
        label: o.hud?.label ?? "SIGNALS",
        spec: "SPEC.04 / DECODE",
        rows: [
          "SOURCE NOISE",
          `LOCK  ${ String( Math.round( morph * 100 ) ).padStart(
            3,
            "0"
          ) }%`,
          `GLYPH ${ text }`,
          `PHASE ${ String( Math.round( ( pr * 360 ) % 360 ) ).padStart(
            3,
            "0"
          ) }°`
        ]
      }
    );
  }

  // ── motion → sound: a soft tone the instant the signal locks ────────────────
  if ( o.audio?.enabled ?? false ) {
    const locked = morph > 0.92;

    if ( locked && !lastLocked ) {
      audio.trigger(
        "beep",
        {
          freq: o.audio?.freq ?? 520,
          duration: o.audio?.duration ?? 0.18,
          gain: o.audio?.gain ?? 0.25,
          attack: 0.003
        }
      );
    }

    lastLocked = locked;
  }
} );
