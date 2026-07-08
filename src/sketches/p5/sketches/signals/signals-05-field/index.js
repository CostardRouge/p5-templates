import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import animation from "@/p5/utils/animation.js";
import drawInstrument from "../_instrument.js";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNALS — 05 / FIELD
//
// A change of morphology for the series: not a filament but a *terrain*. Stacked
// ridge-lines (the joy-division / topographic look) displaced by a looping
// Perlin field, each row filled to the bottom in black so nearer ridges occlude
// the ones behind — a relief that reads as a landscape being scanned. Same
// SIGNALS identity: pure black, low-saturation iridescent, the instrument frame,
// here with a reticle that sweeps the field like a scan head.
//
// Seamless loop: the field morphs by sampling noise on a circle of progression
// (offsets cos/sin of animation.angle), so the relief at progression 0 is exactly
// the relief at progression 1 — no scroll, no wrap, no pop.
// ─────────────────────────────────────────────────────────────────────────────

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

sketch.setup( () => {} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  const rows = Math.round( o.field?.rows ?? 56 );
  const cols = Math.round( o.field?.cols ?? 160 );
  const topMargin = ( o.field?.verticalMargin ?? 0.14 ) * p.height;
  const sideMargin = ( o.field?.horizontalMargin ?? 0.08 ) * p.width;
  const amplitude = ( o.field?.amplitude ?? 0.12 ) * p.height;
  const colFreq = o.field?.colFreq ?? 0.03;
  const rowFreq = o.field?.rowFreq ?? 0.12;
  const morphRadius = o.field?.morphRadius ?? 0.6;
  const ridge = o.field?.ridge ?? 1.0;

  const octaves = Math.round( o.field?.octaves ?? 3 );
  const saturation = o.palette?.saturation ?? 0.28;
  const hueSpread = o.palette?.hueSpread ?? 1.0;
  const lineWeight = ( o.palette?.weight ?? 0.0022 ) * p.width;

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  p.noiseDetail(
    octaves,
    0.5
  );

  const a = animation.angle;
  const ca = p.cos( a ) * morphRadius;
  const sa = p.sin( a ) * morphRadius;

  const left = sideMargin;
  const right = p.width - sideMargin;
  const bottom = p.height - topMargin * 0.4;

  const bg = o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ];

  // Draw back (top) → front (bottom): each row's black fill occludes the ridges
  // behind it, leaving only the silhouette skyline.
  for ( let r = 0; r <= rows; r++ ) {
    const rowT = r / rows;
    const baseY = p.lerp(
      topMargin,
      p.height - topMargin,
      rowT
    );
    const ny = r * rowFreq;

    const ridgePts = [];

    for ( let c = 0; c <= cols; c++ ) {
      const colT = c / cols;
      const x = p.lerp(
        left,
        right,
        colT
      );
      const nx = c * colFreq;

      let n = p.noise(
        nx + ca,
        ny + sa
      );

      // Sharpen into ridges and fade the relief out toward the side edges so the
      // field sits inside the frame instead of being clipped.
      n = Math.pow(
        n,
        ridge
      );
      const edge = Math.sin( colT * p.PI );
      const y = baseY - ( n - 0.5 ) * 2 * amplitude * edge;

      ridgePts.push( {
        x,
        y
      } );
    }

    // Black fill below the ridge (occludes rows behind).
    p.noStroke();
    p.fill( ...bg );
    p.beginShape();
    p.vertex(
      left,
      bottom
    );
    for ( const pt of ridgePts ) {
      p.vertex(
        pt.x,
        pt.y
      );
    }
    p.vertex(
      right,
      bottom
    );
    p.endShape( p.CLOSE );

    // Neon ridge stroke.
    const hue = ( rowT * hueSpread ) % 1;
    const [
      cr,
      cg,
      cb
    ] = iridescent(
      p,
      hue,
      saturation
    );

    p.noFill();
    p.stroke(
      cr,
      cg,
      cb,
      210
    );
    p.strokeWeight( lineWeight );
    p.beginShape();
    for ( const pt of ridgePts ) {
      p.vertex(
        pt.x,
        pt.y
      );
    }
    p.endShape();
  }

  // ── structural instrument frame ─────────────────────────────────────────────
  if ( o.hud?.show ?? true ) {
    // Scan head sweeps left↔right across the field, riding the ridge it crosses.
    const sweep = ( 1 - Math.cos( a ) ) / 2; // 0→1→0, loop-safe
    const headX = p.lerp(
      left,
      right,
      sweep
    );
    const nHead = Math.pow(
      p.noise(
        ( sweep * cols ) * colFreq + ca,
        rows * 0.5 * rowFreq + sa
      ),
      ridge
    );
    const headY = p.height / 2 - ( nHead - 0.5 ) * 2 * amplitude;

    drawInstrument(
      p,
      {
        box: {
          minX: left,
          minY: topMargin - amplitude,
          maxX: right,
          maxY: p.height - topMargin
        },
        head: {
          x: headX,
          y: headY
        },
        hudColor: o.hud?.color ?? [
          180,
          230,
          210
        ],
        label: o.hud?.label ?? "SIGNALS",
        spec: "SPEC.05 / FIELD",
        rows: [
          `RELIEF ${ ( amplitude / p.height ).toFixed( 2 ) }`,
          `ROWS  ${ rows }`,
          `OCT   ${ octaves }`,
          `PHASE ${ String( Math.round( ( animation.progression * 360 ) % 360 ) ).padStart(
            3,
            "0"
          ) }°`
        ]
      }
    );
  }
} );
