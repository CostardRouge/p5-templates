import easing from "./easing.js";
import {
  getP5
} from "./sketch.js";

/**
 * Draws a set of vertical, drifting lines used as a background pattern across
 * the "Animated Text Point" sketches (and any other sketch that wants it).
 *
 * Two behaviours are worth calling out:
 *
 * 1. `columns` may be fractional. The whole part controls how many fully
 *    opaque lines are drawn, while the fractional part fades the newest line
 *    in (and slides it across from the edge). Feeding it an easing value that
 *    grows smoothly — instead of a truncated integer — makes a new line appear
 *    progressively rather than snapping into place.
 *
 * 2. Every line spans the full canvas height. The polyline is iterated with an
 *    inclusive end (lerp `0 … 1`), so the first vertex sits exactly on the top
 *    edge and the last vertex exactly on the bottom edge (plus optional
 *    `overshoot`). Previously the iteration stopped just short of `1`, leaving
 *    the path "open" before it reached the bottom.
 *
 * @param {Object}   params
 * @param {number}   params.columns       Number of lines (fractional allowed).
 * @param {number}   [params.time]        Phase fed into the horizontal drift.
 * @param {number}   [params.weight]      Stroke weight of each line.
 * @param {number[]} [params.color]       Stroke color as [r, g, b] or [r, g, b, a].
 * @param {number}   [params.overshoot]   Pixels the lines extend past the top/bottom edges.
 * @param {number}   [params.depth]       Z translation (WEBGL only) to push the pattern back.
 * @param {boolean}  [params.centered]    Translate from the centre to the top-left (WEBGL).
 * @param {number}   [params.precision]   Lerp step between vertices (smaller = smoother).
 * @param {Function} [params.easingFn]    Easing applied to the horizontal drift.
 */
export default function drawBackgroundPattern( {
  columns,
  time = 0,
  weight = 3,
  color = [
    255,
    255,
    255
  ],
  overshoot = 0,
  depth = 0,
  centered = false,
  precision = 0.04,
  easingFn = easing.easeInOutBack
} ) {
  const p = getP5();

  if ( !( columns > 0 ) ) {
    return;
  }

  p.push();
  p.noFill();
  p.strokeWeight( weight );

  if ( centered ) {
    p.translate(
      -p.width / 2,
      -p.height / 2,
      depth
    );
  } else if ( depth ) {
    p.translate(
      0,
      0,
      depth
    );
  }

  const columnSize = p.width / columns;
  const halfColumnSize = columnSize / 2;
  const columnPadding = weight + halfColumnSize;

  const top = -overshoot;
  const bottom = p.height + overshoot;
  const steps = Math.max(
    1,
    Math.ceil( 1 / precision )
  );

  const [
    r,
    g,
    b,
    a = 255
  ] = color;

  const lineCount = Math.ceil( columns );

  for ( let i = 0; i < lineCount; i++ ) {
    // Fractional `columns` fades the newest line in (0 → 1) so it shows up
    // progressively instead of popping in at full strength.
    const lineAlpha = p.constrain(
      columns - i,
      0,
      1
    );

    if ( lineAlpha <= 0 ) {
      continue;
    }

    const x = i * columnSize + halfColumnSize;
    const driftBound = ( halfColumnSize + columnPadding ) * p.sin( time + i );

    p.stroke(
      r,
      g,
      b,
      a * lineAlpha
    );
    p.beginShape();

    for ( let step = 0; step <= steps; step++ ) {
      // `0 … 1` inclusive → the line spans the full height, top to bottom.
      const lerpIndex = step / steps;
      const y = p.lerp(
        top,
        bottom,
        lerpIndex
      );
      const driftX = p.map(
        easingFn( lerpIndex ),
        0,
        1,
        -driftBound,
        driftBound
      );

      p.vertex(
        x + driftX,
        y
      );
    }

    p.endShape();
  }

  p.pop();
}
