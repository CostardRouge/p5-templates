// ── The loader scene: a loading screen that fills over its slot ─────────────
//
// The progress is fake by design — a beat of "something is coming", not a
// measurement — and a pure function of the scene's progress, with a `stutter`
// that makes it hesitate the way a download does. Five looks share one
// progress value.

import {
  cssColor, paintPlate, plateColors
} from "./plate.js";

const TAU = Math.PI * 2;

function clamp01( value ) {
  return Math.min(
    1,
    Math.max(
      0,
      value
    )
  );
}

/**
 * The displayed progress at scene progress `t`: reaches 1 at 90 % of the slot
 * and holds, with `stutter` hesitations on the way up. Exported for the test.
 */
export function loaderProgress(
  t, stutter = 0
) {
  const base = clamp01( t / 0.9 );
  const wobble = clamp01( stutter ) * 0.12 * Math.sin( t * TAU * 2.7 ) * Math.sin( t * TAU * 1.3 + 0.4 );

  return clamp01( base + wobble * ( 1 - base ) * base * 4 );
}

const BOOT_LINES = [
  "mounting renderer",
  "loading shaders",
  "warming palette",
  "seeding noise",
  "binding controls",
  "syncing clock",
  "compositing layers",
  "ready"
];

/**
 * Paint a loader scene into `g`, laid out for `width` × `height`.
 *
 * @param {object} g a P2D p5.Graphics, transformed to layout units
 * @param {object} scene the SequenceLoaderSceneSchema value
 * @param {{ progress: number, seconds: number, font: object|null }} env
 */
export function paintLoader(
  g, scene, width, height, env
) {
  const t = clamp01( env.progress );

  paintPlate(
    g,
    scene.background,
    width,
    height,
    t
  );

  const colors = plateColors(
    scene.background,
    t
  );
  const p = loaderProgress(
    t,
    Number( scene.stutter ) || 0
  );
  const fill = Array.isArray( scene.fill ) ? scene.fill : [
    255,
    255,
    255
  ];
  const size = Number( scene.size ) || 28;
  const style = scene.style ?? "bar";
  const ctx = g.drawingContext;
  const cx = width / 2;
  const cy = height / 2;
  const percent = `${ Math.round( p * 100 ) }%`;
  const hasFont = Boolean( env.font?.font );

  g.push();

  if ( hasFont ) {
    g.textFont( env.font );
  }

  g.textSize( size );
  g.noStroke();
  g.fill(
    fill[ 0 ],
    fill[ 1 ],
    fill[ 2 ]
  );

  const track = cssColor(
    fill,
    0.22
  );
  const bar = cssColor( fill );

  switch ( style ) {
    case "ring": {
      const radius = Math.min(
        width,
        height
      ) * 0.18;
      const weight = size * 0.45;

      ctx.lineWidth = weight;
      ctx.lineCap = "round";
      ctx.strokeStyle = track;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius,
        0,
        TAU
      );
      ctx.stroke();
      ctx.strokeStyle = bar;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius,
        -Math.PI / 2,
        -Math.PI / 2 + p * TAU
      );
      ctx.stroke();

      if ( hasFont ) {
        g.textAlign(
          g.CENTER,
          g.CENTER
        );

        if ( scene.showPercent !== false ) {
          g.text(
            percent,
            cx,
            cy
          );
        }

        g.textSize( size * 0.6 );
        g.text(
          scene.label ?? "",
          cx,
          cy + radius + size * 1.2
        );
      }
      break;
    }
    case "dots": {
      const count = 12;
      const span = width * 0.5;
      const step = span / ( count - 1 );
      const lit = Math.round( p * count );

      for ( let i = 0; i < count; i++ ) {
        ctx.fillStyle = i < lit ? bar : track;
        ctx.beginPath();
        ctx.arc(
          cx - span / 2 + i * step,
          cy,
          size * 0.22,
          0,
          TAU
        );
        ctx.fill();
      }

      if ( hasFont ) {
        g.textAlign(
          g.CENTER,
          g.CENTER
        );
        g.text(
          `${ scene.label ?? "" }${ scene.showPercent !== false ? `  ${ percent }` : "" }`,
          cx,
          cy - size * 1.8
        );
      }
      break;
    }
    case "blocks": {
      const count = 20;
      const span = width * 0.6;
      const gap = span / count * 0.25;
      const block = span / count - gap;
      const lit = Math.floor( p * count + 0.0001 );

      for ( let i = 0; i < count; i++ ) {
        ctx.fillStyle = i < lit ? bar : track;
        ctx.fillRect(
          cx - span / 2 + i * ( block + gap ),
          cy - size * 0.4,
          block,
          size * 0.8
        );
      }

      if ( hasFont ) {
        g.textAlign(
          g.LEFT,
          g.BOTTOM
        );
        g.text(
          scene.label ?? "",
          cx - span / 2,
          cy - size * 0.9
        );

        if ( scene.showPercent !== false ) {
          g.textAlign(
            g.RIGHT,
            g.BOTTOM
          );
          g.text(
            percent,
            cx + span / 2,
            cy - size * 0.9
          );
        }
      }
      break;
    }
    case "boot": {
      // A boot log: one line per step, the current one with a live cursor.
      if ( !hasFont ) {
        break;
      }

      const lineSize = size * 0.8;
      const lineHeight = lineSize * 1.5;
      const shown = Math.min(
        BOOT_LINES.length,
        Math.floor( p * BOOT_LINES.length + 0.0001 ) + ( p < 1 ? 1 : 0 )
      );
      const left = width * 0.1;
      let y = cy - ( BOOT_LINES.length * lineHeight ) / 2;

      g.textSize( lineSize );
      g.textAlign(
        g.LEFT,
        g.TOP
      );

      for ( let i = 0; i < shown; i++ ) {
        const done = i < shown - 1 || p >= 1;
        const caret = Math.sin( env.seconds * 9 ) > 0 ? "▌" : " ";

        g.fill(
          colors.accent[ 0 ],
          colors.accent[ 1 ],
          colors.accent[ 2 ]
        );
        g.text(
          done ? "[ ok ]" : "[ .. ]",
          left,
          y
        );
        g.fill(
          fill[ 0 ],
          fill[ 1 ],
          fill[ 2 ]
        );
        g.text(
          `${ BOOT_LINES[ i ] }${ done ? "" : ` ${ caret }` }`,
          left + lineSize * 4.5,
          y
        );
        y += lineHeight;
      }

      if ( scene.showPercent !== false ) {
        g.textAlign(
          g.RIGHT,
          g.TOP
        );
        g.text(
          percent,
          width * 0.9,
          cy - ( BOOT_LINES.length * lineHeight ) / 2
        );
      }
      break;
    }
    default: {
      // bar
      const span = width * 0.6;
      const h = size * 0.5;
      const radius = h / 2;

      ctx.fillStyle = track;
      ctx.beginPath();
      ctx.roundRect(
        cx - span / 2,
        cy - h / 2,
        span,
        h,
        radius
      );
      ctx.fill();

      if ( p > 0 ) {
        ctx.fillStyle = bar;
        ctx.beginPath();
        ctx.roundRect(
          cx - span / 2,
          cy - h / 2,
          Math.max(
            h,
            span * p
          ),
          h,
          radius
        );
        ctx.fill();
      }

      if ( hasFont ) {
        g.textAlign(
          g.LEFT,
          g.BOTTOM
        );
        g.text(
          scene.label ?? "",
          cx - span / 2,
          cy - h
        );

        if ( scene.showPercent !== false ) {
          g.textAlign(
            g.RIGHT,
            g.BOTTOM
          );
          g.text(
            percent,
            cx + span / 2,
            cy - h
          );
        }
      }
    }
  }

  g.pop();
}
