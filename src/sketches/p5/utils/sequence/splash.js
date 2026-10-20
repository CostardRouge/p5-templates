// ── The splash scene: a title card animated in over a plate ─────────────────
//
// Everything is a function of the scene's own progress (0..1 over its slot)
// and the loop seconds, so the card plays the same in a capture. Text goes
// through p5 on the scene's P2D buffer with the shared fonts (string.js); the
// accents behind it are coloured from the plate.

import easing from "../easing.js";
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

// A deterministic pseudo-random in [0, 1) from an index.
function pseudo(
  i, salt = 0
) {
  const x = Math.sin( i * 127.1 + salt * 311.7 ) * 43758.5453;

  return x - Math.floor( x );
}

/** Where the entrance of element `i` of `n` stands at `t`, with a stagger. */
function entrance(
  t, i, n, span = 0.3, stagger = 0.4
) {
  const start = n > 1 ? ( i / n ) * span * stagger : 0;
  const length = span * ( 1 - stagger ) + span * stagger / Math.max(
    n,
    1
  );

  return clamp01( ( t - start ) / Math.max(
    length,
    0.001
  ) );
}

function paintAccents(
  g, accent, t, seconds, colors, width, height
) {
  if ( !accent || accent === "none" ) {
    return;
  }

  const ctx = g.drawingContext;
  const reach = Math.hypot(
    width,
    height
  );

  ctx.save();

  switch ( accent ) {
    case "bars": {
      // Five diagonal bars sliding in from the left, one after the other.
      ctx.translate(
        width / 2,
        height / 2
      );
      ctx.rotate( -0.35 );

      for ( let i = 0; i < 5; i++ ) {
        const e = easing.easeOutCubic( entrance(
          t,
          i,
          5,
          0.5,
          0.6
        ) );
        const y = ( i - 2 ) * height * 0.22;
        const w = reach * 0.9 * e;

        ctx.fillStyle = cssColor(
          i % 2 ? colors.to : colors.accent,
          0.18 + 0.1 * ( i % 3 )
        );
        ctx.fillRect(
          -reach / 2 + ( reach - w ) * ( i % 2 ? 1 : 0 ),
          y,
          w,
          height * 0.08
        );
      }
      break;
    }
    case "rings": {
      // Concentric rings breathing out of the centre.
      ctx.translate(
        width / 2,
        height / 2
      );
      ctx.lineWidth = Math.max(
        2,
        reach * 0.004
      );

      for ( let i = 0; i < 6; i++ ) {
        const phase = ( t * 1.2 + i / 6 ) % 1;
        const r = phase * reach * 0.6;

        ctx.strokeStyle = cssColor(
          i % 2 ? colors.to : colors.accent,
          ( 1 - phase ) * 0.5
        );
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          Math.max(
            r,
            0.1
          ),
          0,
          TAU
        );
        ctx.stroke();
      }
      break;
    }
    case "grid": {
      // A dot grid whose dots swell in a wave from the top-left.
      const cols = 12;
      const rows = Math.round( cols * height / width );
      const cellW = width / cols;
      const cellH = height / Math.max(
        rows,
        1
      );

      ctx.fillStyle = cssColor(
        colors.accent,
        0.45
      );

      for ( let r = 0; r < rows; r++ ) {
        for ( let c = 0; c < cols; c++ ) {
          const wave = 0.5 + 0.5 * Math.sin( ( c + r ) * 0.6 - seconds * 2.2 );
          const radius = Math.min(
            cellW,
            cellH
          ) * ( 0.06 + 0.16 * wave ) * easing.easeOutCubic( clamp01( t * 3 ) );

          ctx.beginPath();
          ctx.arc(
            ( c + 0.5 ) * cellW,
            ( r + 0.5 ) * cellH,
            radius,
            0,
            TAU
          );
          ctx.fill();
        }
      }
      break;
    }
    case "confetti": {
      // Deterministic falling pieces, spinning, in the plate's two colours.
      for ( let i = 0; i < 60; i++ ) {
        const x = pseudo( i ) * width;
        const speed = 0.4 + pseudo(
          i,
          1
        ) * 0.8;
        const y = ( ( pseudo(
          i,
          2
        ) + t * speed ) % 1.2 - 0.1 ) * height;
        const size = reach * ( 0.006 + pseudo(
          i,
          3
        ) * 0.012 );
        const spin = seconds * ( 1 + pseudo(
          i,
          4
        ) * 3 ) + i;

        ctx.save();
        ctx.translate(
          x,
          y
        );
        ctx.rotate( spin );
        ctx.fillStyle = cssColor(
          i % 3 === 0 ? colors.accent : ( i % 3 === 1 ? colors.to : [
            255,
            255,
            255
          ] ),
          0.8
        );
        ctx.fillRect(
          -size / 2,
          -size,
          size,
          size * 2
        );
        ctx.restore();
      }
      break;
    }
    case "glow": {
      // A soft pool of light behind the words, pulsing slowly.
      const pulse = 0.85 + 0.15 * Math.sin( seconds * 1.7 );
      const glow = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        reach * 0.35 * pulse
      );

      glow.addColorStop(
        0,
        cssColor(
          colors.accent,
          0.75 * easing.easeOutCubic( clamp01( t * 2.5 ) )
        )
      );
      glow.addColorStop(
        1,
        cssColor(
          colors.accent,
          0
        )
      );
      ctx.fillStyle = glow;
      ctx.fillRect(
        0,
        0,
        width,
        height
      );
      break;
    }
    default:
      break;
  }

  ctx.restore();
}

const ALIGN_ANCHOR = {
  left: 0,
  center: 0.5,
  right: 1
};

/**
 * One line of text, animated per `animation` at local progress `t`, laid out
 * from (x, y) with `align`. Returns nothing; draws through `g`.
 */
function paintLine(
  g, line, {
    x,
    y,
    size,
    align,
    animation,
    t,
    seconds,
    fill
  }
) {
  if ( !line ) {
    return;
  }

  const anchor = ALIGN_ANCHOR[ align ] ?? 0.5;

  g.push();
  g.textSize( size );
  g.noStroke();

  const total = g.textWidth( line );
  const left = x - total * anchor;

  switch ( animation ) {
    case "letters": {
      // Each glyph rises into place, one after the other.
      const glyphs = Array.from( line );
      let cursor = left;

      g.textAlign(
        g.LEFT,
        g.CENTER
      );

      glyphs.forEach( (
        glyph, i
      ) => {
        const e = easing.easeOutCubic( entrance(
          t,
          i,
          glyphs.length,
          0.45,
          0.7
        ) );
        const w = g.textWidth( glyph );

        g.fill(
          fill[ 0 ],
          fill[ 1 ],
          fill[ 2 ],
          255 * e
        );
        g.text(
          glyph,
          cursor,
          y + ( 1 - e ) * size * 0.5
        );
        cursor += w;
      } );
      break;
    }
    case "typewriter": {
      const glyphs = Array.from( line );
      const shown = Math.floor( clamp01( t / 0.55 ) * glyphs.length );
      const typed = glyphs.slice(
        0,
        shown
      ).join( "" );
      const caret = shown < glyphs.length || Math.sin( seconds * 8 ) > 0 ? "_" : "";

      g.textAlign(
        g.LEFT,
        g.CENTER
      );
      g.fill(
        fill[ 0 ],
        fill[ 1 ],
        fill[ 2 ]
      );
      g.text(
        typed + caret,
        left,
        y
      );
      break;
    }
    case "scale": {
      const e = easing.easeOutBack( clamp01( t / 0.35 ) );

      g.translate(
        x,
        y
      );
      g.scale( 0.6 + 0.4 * e );
      g.textAlign(
        g.CENTER,
        g.CENTER
      );
      g.fill(
        fill[ 0 ],
        fill[ 1 ],
        fill[ 2 ],
        255 * clamp01( t / 0.2 )
      );
      g.text(
        line,
        ( 0.5 - anchor ) * total,
        0
      );
      break;
    }
    case "slide": {
      const e = easing.easeOutQuint( clamp01( t / 0.4 ) );

      g.textAlign(
        g.LEFT,
        g.CENTER
      );
      g.fill(
        fill[ 0 ],
        fill[ 1 ],
        fill[ 2 ],
        255 * e
      );
      g.text(
        line,
        left - ( 1 - e ) * total * 0.6,
        y
      );
      break;
    }
    case "none": {
      g.textAlign(
        g.LEFT,
        g.CENTER
      );
      g.fill(
        fill[ 0 ],
        fill[ 1 ],
        fill[ 2 ]
      );
      g.text(
        line,
        left,
        y
      );
      break;
    }
    default: {
      // rise
      const e = easing.easeOutCubic( clamp01( t / 0.35 ) );

      g.textAlign(
        g.LEFT,
        g.CENTER
      );
      g.fill(
        fill[ 0 ],
        fill[ 1 ],
        fill[ 2 ],
        255 * e
      );
      g.text(
        line,
        left,
        y + ( 1 - e ) * size * 0.6
      );
    }
  }

  g.pop();
}

/**
 * Paint a splash scene into `g`, laid out for `width` × `height`.
 *
 * @param {object} g a P2D p5.Graphics, transformed to layout units
 * @param {object} scene the SequenceSplashSceneSchema value
 * @param {{ progress: number, seconds: number, font: object|null }} env
 */
export function paintSplash(
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

  paintAccents(
    g,
    scene.accent,
    t,
    env.seconds,
    colors,
    width,
    height
  );

  // Fonts arrive asynchronously; until then the plate and the accents already
  // make the scene — the words land on the next frame they can.
  if ( !env.font?.font ) {
    return;
  }

  const fill = Array.isArray( scene.fill ) ? scene.fill : [
    255,
    255,
    255
  ];
  const align = scene.align ?? "center";
  const x = width * ( scene.position?.x ?? 0.5 );
  const lines = String( scene.title ?? "" ).split( "\n" );

  g.push();
  g.textFont( env.font );

  // `size` is the size asked for; a headline wider than the frame is shrunk
  // to fit it (with a margin), so the same card reads on a 1080 canvas and in
  // a 540 layer instead of losing its first and last letters.
  const asked = Number( scene.size ) || 120;

  g.textSize( asked );

  const widest = lines.reduce(
    (
      max, line
    ) => Math.max(
      max,
      g.textWidth( line )
    ),
    0
  );
  const room = width * 0.92;
  const size = widest > room ? asked * room / widest : asked;
  const lineHeight = size * 1.05;
  const subtitle = String( scene.subtitle ?? "" ).trim();
  const blockHeight = lines.length * lineHeight + ( subtitle ? size * 0.5 : 0 );
  let y = height * ( scene.position?.y ?? 0.5 ) - blockHeight / 2 + lineHeight / 2;

  lines.forEach( (
    line, i
  ) => {
    paintLine(
      g,
      line,
      {
        x,
        y,
        size,
        align,
        animation: scene.animation ?? "letters",
        // Later lines start a little after the first.
        t: clamp01( t - i * 0.06 ),
        seconds: env.seconds,
        fill
      }
    );
    y += lineHeight;
  } );

  if ( subtitle ) {
    paintLine(
      g,
      subtitle,
      {
        x,
        y: y - lineHeight / 2 + size * 0.3,
        size: size * 0.28,
        align,
        animation: "rise",
        t: clamp01( t - 0.15 ),
        seconds: env.seconds,
        fill
      }
    );
  }

  g.pop();
}
