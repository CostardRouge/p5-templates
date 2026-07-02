import {
  getP5
} from "@/p5/utils/sketch.js";
import options from "@/p5/utils/options.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";

export function getAlphabet( fallback = "0123456789" ) {
  const tx = options.sketch?.text ?? {};
  const mode = tx.mode ?? "single";

  if ( mode === "multiple" && Array.isArray( tx.value ) ) {
    return tx.value.filter( ( v ) => v != null && v !== "" );
  }

  const raw = typeof tx.value === "string" && tx.value.length
    ? tx.value
    : fallback;

  return raw.split( "" );
}

export function drawGrid( {
  xCount, yCount, color, weight = 1, skipX = [], skipY = []
} ) {
  const p = getP5();

  p.stroke( color );
  p.strokeWeight( weight );

  const xSize = p.width / xCount;
  const ySize = p.height / yCount;

  for ( let x = 0; x < xCount - 1; x++ ) {
    if ( !skipX.includes( x ) ) {
      p.line(
        xSize + x * xSize,
        0,
        xSize + x * xSize,
        p.height
      );
    }
  }

  for ( let y = 0; y < yCount - 1; y++ ) {
    if ( !skipY.includes( y ) ) {
      p.line(
        0,
        ySize + y * ySize,
        p.width,
        ySize + y * ySize
      );
    }
  }
}

export function drawShape(
  points, closed = false, kind
) {
  const p = getP5();

  p.beginShape( kind );

  for ( let i = 0; i < points.length; i++ ) {
    const {
      x, y, z = 0
    } = points[ i ];

    p.vertex(
      x,
      y,
      z
    );
  }

  p.endShape( closed ? p.CLOSE : undefined );
}

export function getFont(
  name, fallback = "martian"
) {
  return string.fonts?.[ name ] ?? string.fonts?.[ fallback ] ?? string.fonts.martian;
}

export function loopedTime() {
  const loop = options.sketch?.loop ?? {};
  const scale = loop.timeScale ?? 1;
  const offset = loop.timeOffset ?? 0;

  return animation.progression * scale + offset;
}

// Loop-exact scroll: `loopedTime() * multiplier` only returns to its start
// value at the seam when the total sweep advances a WHOLE number of
// `period`s per loop (2π for a raw sin/cos argument, or `values.length` for
// an animation.ease list of that length). Snap the number of periods
// completed per loop to the nearest whole number — same cycles-per-loop
// idiom as flowers-shaders — so every trig/ease term driven by the shared
// clock returns exactly to its start at the seam.
export function loopedPhase(
  multiplier = 1, period = getP5().TAU
) {
  const loop = options.sketch?.loop ?? {};
  const scale = loop.timeScale ?? 1;
  const offset = loop.timeOffset ?? 0;
  const cycles = Math.round( ( scale * multiplier ) / period );

  return animation.progression * cycles * period + offset * multiplier;
}

export function getColorFunction( name ) {
  return name ?? "rainbow";
}
