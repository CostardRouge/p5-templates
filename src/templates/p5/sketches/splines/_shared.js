import {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import createGlowBatchRenderer from "@/p5/utils/glowBatchGpu.js";

// The glowing curve used to be stroked segment-by-segment on the CPU, once per
// glow layer, once per spline — fine for one procedural curve, but the cost
// scaled with the number of live entities and dragged the draw loop down. Now the
// dense Chaikin geometry is built once on flat typed arrays (no p5.Vector churn),
// uploaded once, and the GPU re-draws it per glow layer while computing the
// rainbow colour in the shader (see utils/glowBatchGpu.js). The geometry and
// colours match the originals exactly, so the look is unchanged.
const batch = createGlowBatchRenderer();

const TWO_PI = Math.PI * 2;

/**
 * Shared geometry for the `splines` category.
 *
 * The whole point of these sketches is to round the corners of a polyline that
 * passes through a handful of points WITHOUT us ever computing Bézier control
 * handles by hand. Three strategies are provided, all "control-point free" from
 * the caller's perspective:
 *
 *   - chaikin    → pure corner-cutting by averaging. No curve primitive at all,
 *                  just weighted midpoints. The curve never reaches the original
 *                  points, it stays inside the polygon (exactly the rounded look
 *                  we are after).
 *   - quadratic  → quadratic Béziers whose anchors are the edge midpoints and
 *                  whose control points are the original points themselves, so
 *                  there is nothing extra to invent.
 *   - catmull-rom → p5's built-in `curveVertex()` (a Catmull-Rom spline). You
 *                  only feed it the points to pass through; p5 derives the
 *                  tangents internally.
 */

const MARGIN_RATIO = 0.12;

export function buildBasePoints( {
  count,
  seed,
  layout
} ) {
  const p = getP5();
  const margin = Math.min(
    p.width,
    p.height
  ) * MARGIN_RATIO;

  if ( layout === "corners" ) {
    return [
      p.createVector(
        margin,
        margin
      ),
      p.createVector(
        p.width - margin,
        margin
      ),
      p.createVector(
        p.width - margin,
        p.height - margin
      ),
      p.createVector(
        margin,
        p.height - margin
      )
    ];
  }

  if ( layout === "ring" ) {
    const cx = p.width / 2;
    const cy = p.height / 2;
    const radius = Math.min(
      p.width,
      p.height
    ) / 2 - margin;

    return Array.from(
      {
        length: count
      },
      (
        _, index
      ) => {
        const angle = index / count * p.TAU - p.HALF_PI;

        return p.createVector(
          cx + Math.cos( angle ) * radius,
          cy + Math.sin( angle ) * radius
        );
      }
    );
  }

  // "random" — seeded so the base layout is stable from frame to frame.
  p.randomSeed( seed );

  return Array.from(
    {
      length: count
    },
    () => p.createVector(
      p.random(
        margin,
        p.width - margin
      ),
      p.random(
        margin,
        p.height - margin
      )
    )
  );
}

/**
 * Drift every point on a small noise loop so the curve stays alive. Sampling
 * the noise field on a circle (cos/sin of the animation angle) keeps the motion
 * seamless when the animation loops.
 */
export function animatePoints(
  basePoints, {
    motion,
    speed,
    seed,
    angle
  }
) {
  const p = getP5();

  if ( motion <= 0 ) {
    return basePoints;
  }

  const drift = Math.min(
    p.width,
    p.height
  ) * motion;
  const nx = Math.cos( angle * speed );
  const ny = Math.sin( angle * speed );

  return basePoints.map( (
    base, index
  ) => {
    const offsetX = p.map(
      p.noise(
        seed + index * 7.3 + nx,
        10 + ny
      ),
      0,
      1,
      -drift,
      drift
    );
    const offsetY = p.map(
      p.noise(
        seed + index * 7.3 + 50 + nx,
        90 + ny
      ),
      0,
      1,
      -drift,
      drift
    );

    return p.createVector(
      base.x + offsetX,
      base.y + offsetY
    );
  } );
}

/**
 * Chaikin's corner-cutting. Each iteration replaces every corner by two points
 * sitting at 1/4 and 3/4 of each edge — i.e. weighted averages of neighbouring
 * points. More iterations = smoother. Returns the dense list of vertices.
 */
export function chaikin(
  points, iterations, closed
) {
  let result = points;

  for ( let i = 0; i < iterations; i++ ) {
    result = chaikinStep(
      result,
      closed
    );
  }

  return result;
}

function chaikinStep(
  points, closed
) {
  const p = getP5();
  const count = points.length;
  const out = [];
  const limit = closed ? count : count - 1;

  for ( let i = 0; i < limit; i++ ) {
    const a = points[ i ];
    const b = points[ ( i + 1 ) % count ];

    out.push( p.createVector(
      0.75 * a.x + 0.25 * b.x,
      0.75 * a.y + 0.25 * b.y
    ) );
    out.push( p.createVector(
      0.25 * a.x + 0.75 * b.x,
      0.25 * a.y + 0.75 * b.y
    ) );
  }

  if ( !closed ) {
    out.unshift( points[ 0 ].copy() );
    out.push( points[ count - 1 ].copy() );
  }

  return out;
}

/**
 * Same corner-cutting as `chaikin`, but on flat [x0, y0, x1, y1, …] Float32Arrays
 * instead of p5.Vector objects. The GPU path only needs the coordinates, and the
 * dense polyline can reach thousands of points per spline, so avoiding the vector
 * allocations removes a big chunk of per-frame GC. Input is the sketch's vectors;
 * output is a packed Float32Array of the dense vertices.
 */
export function chaikinFlat(
  points, iterations, closed
) {
  let flat = new Float32Array( points.length * 2 );

  for ( let i = 0; i < points.length; i++ ) {
    flat[ i * 2 ] = points[ i ].x;
    flat[ i * 2 + 1 ] = points[ i ].y;
  }

  for ( let i = 0; i < iterations; i++ ) {
    flat = chaikinStepFlat(
      flat,
      closed
    );
  }

  return flat;
}

function chaikinStepFlat(
  flat, closed
) {
  const count = flat.length / 2;
  const limit = closed ? count : count - 1;
  const cutCount = limit * 2;
  const outCount = closed ? cutCount : cutCount + 2;
  const out = new Float32Array( outCount * 2 );
  let o = 0;

  // Open polylines keep their original endpoints (Chaikin only cuts corners).
  if ( !closed ) {
    out[ o++ ] = flat[ 0 ];
    out[ o++ ] = flat[ 1 ];
  }

  for ( let i = 0; i < limit; i++ ) {
    const ai = i * 2;
    const bi = ( ( i + 1 ) % count ) * 2;
    const ax = flat[ ai ];
    const ay = flat[ ai + 1 ];
    const bx = flat[ bi ];
    const by = flat[ bi + 1 ];

    out[ o++ ] = 0.75 * ax + 0.25 * bx;
    out[ o++ ] = 0.75 * ay + 0.25 * by;
    out[ o++ ] = 0.25 * ax + 0.75 * bx;
    out[ o++ ] = 0.25 * ay + 0.75 * by;
  }

  if ( !closed ) {
    out[ o++ ] = flat[ ( count - 1 ) * 2 ];
    out[ o++ ] = flat[ ( count - 1 ) * 2 + 1 ];
  }

  return out;
}

/**
 * Emit a Catmull-Rom spline through `points` using p5's `curveVertex()`.
 * Caller is responsible for stroke / fill styling.
 */
export function emitCatmullRom(
  points, closed, tension
) {
  const p = getP5();
  const count = points.length;

  p.curveTightness( tension );
  p.beginShape();

  if ( closed ) {
    for ( let i = -1; i <= count + 1; i++ ) {
      const v = points[ ( i % count + count ) % count ];

      p.curveVertex(
        v.x,
        v.y
      );
    }
  } else {
    p.curveVertex(
      points[ 0 ].x,
      points[ 0 ].y
    );

    for ( const v of points ) {
      p.curveVertex(
        v.x,
        v.y
      );
    }

    p.curveVertex(
      points[ count - 1 ].x,
      points[ count - 1 ].y
    );
  }

  p.endShape();
}

/**
 * Emit a chain of quadratic Béziers. Anchors are the edge midpoints, control
 * points are the original points — so the corners round off automatically and
 * we never invent an extra handle.
 */
export function emitQuadraticMidpoint(
  points, closed
) {
  const p = getP5();
  const count = points.length;
  const mid = (
    a, b
  ) => p.createVector(
    ( a.x + b.x ) / 2,
    ( a.y + b.y ) / 2
  );

  p.beginShape();

  if ( closed ) {
    const start = mid(
      points[ count - 1 ],
      points[ 0 ]
    );

    p.vertex(
      start.x,
      start.y
    );

    for ( let i = 0; i < count; i++ ) {
      const ctrl = points[ i ];
      const anchor = mid(
        points[ i ],
        points[ ( i + 1 ) % count ]
      );

      p.quadraticVertex(
        ctrl.x,
        ctrl.y,
        anchor.x,
        anchor.y
      );
    }

    p.endShape( p.CLOSE );
  } else {
    p.vertex(
      points[ 0 ].x,
      points[ 0 ].y
    );

    for ( let i = 1; i < count - 1; i++ ) {
      const ctrl = points[ i ];
      const anchor = mid(
        points[ i ],
        points[ i + 1 ]
      );

      p.quadraticVertex(
        ctrl.x,
        ctrl.y,
        anchor.x,
        anchor.y
      );
    }

    p.vertex(
      points[ count - 1 ].x,
      points[ count - 1 ].y
    );

    p.endShape();
  }
}

/**
 * Uniformly scale a list of points about the canvas center. Used as the sketch's
 * "general size" control: factor < 1 shrinks the whole curve toward the centre,
 * factor > 1 grows it. Stroke weights and marker sizes are untouched.
 */
export function scaleAboutCenter(
  points, factor
) {
  const p = getP5();

  if ( factor === 1 ) {
    return points;
  }

  const cx = p.width / 2;
  const cy = p.height / 2;

  return points.map( ( v ) => p.createVector(
    cx + ( v.x - cx ) * factor,
    cy + ( v.y - cy ) * factor
  ) );
}

/**
 * Draw a single dashed segment between two points. Used by the demonstration
 * overlay to render the raw polygon as a dashed outline.
 */
export function dashedLine(
  a, b, dash, gap
) {
  const p = getP5();
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(
    dx,
    dy
  );

  if ( length === 0 ) {
    return;
  }

  const step = Math.max(
    0.001,
    dash + Math.max(
      0,
      gap
    )
  );
  const ux = dx / length;
  const uy = dy / length;

  for ( let travelled = 0; travelled < length; travelled += step ) {
    const end = Math.min(
      travelled + dash,
      length
    );

    p.line(
      a.x + ux * travelled,
      a.y + uy * travelled,
      a.x + ux * end,
      a.y + uy * end
    );
  }
}

// ── Rendering ──────────────────────────────────────────────────────────────
// These were authored in splines-v0 and are shared so any spline sketch can
// render a curve through an arbitrary list of points with the same look.

/**
 * The faint angular polygon: the "before" half of the demo, so the rounded
 * curve has something obvious to be compared against. Solid or dashed.
 */
export function drawPolygonOverlay(
  points, closed, cfg
) {
  const p = getP5();

  p.noFill();
  p.strokeWeight( cfg.weight ?? 2 );
  p.stroke( ...( cfg.color ?? [
    255,
    255,
    255,
    70
  ] ) );

  if ( cfg.dashed ) {
    const count = points.length;
    const edges = closed ? count : count - 1;

    for ( let i = 0; i < edges; i++ ) {
      dashedLine(
        points[ i ],
        points[ ( i + 1 ) % count ],
        cfg.dash ?? 18,
        cfg.gap ?? 12
      );
    }

    return;
  }

  p.beginShape();
  points.forEach( ( v ) => p.vertex(
    v.x,
    v.y
  ) );
  p.endShape( closed ? p.CLOSE : undefined );
}

/**
 * The original points as markers (outer disc + inner core), kept on top of the
 * glowing curve. `size` is the general point diameter in pixels.
 */
export function drawPointMarkers(
  points, cfg
) {
  const p = getP5();
  const size = cfg.size ?? 14;
  const coreRatio = cfg.coreRatio ?? 0.36;

  p.noStroke();
  points.forEach( ( v ) => {
    p.fill( ...( cfg.color ?? [
      255,
      255,
      255,
      255
    ] ) );
    p.circle(
      v.x,
      v.y,
      size
    );

    if ( coreRatio > 0 ) {
      p.fill( ...( cfg.coreColor ?? [
        10,
        10,
        14,
        255
      ] ) );
      p.circle(
        v.x,
        v.y,
        size * coreRatio
      );
    }
  } );
}

/**
 * Per-segment half-thickness factor for the variable-thickness stroke profile.
 * t is the segment midpoint along the curve, 0..1. Returns 1.0 for closed curves
 * (no start/end to taper) and lerps between startFactor → 1 → endFactor with the
 * chosen easing for open curves, so the user can independently dial the start
 * thickness, the end thickness, and how aggressive the transition is.
 */
function _thicknessProfile(
  t, startFactor, endFactor, easeFn, closed
) {
  if ( closed || ( startFactor === 1 && endFactor === 1 ) ) {
    return 1;
  }

  if ( t <= 0.5 ) {
    return startFactor + ( 1 - startFactor ) * easeFn( t * 2 );
  }

  return 1 + ( endFactor - 1 ) * easeFn( ( t - 0.5 ) * 2 );
}

/**
 * Queue one spline's dense Chaikin polyline onto the GPU stroke batch: open a new
 * stroke group, then push one segment per dense edge with its hue + half-thickness
 * factor. Per-layer thickness and opacity are still applied by the GPU when
 * `drawStrokes` re-draws the geometry — so each segment is emitted ONCE here
 * instead of once per glow layer.
 *
 *   gradient → hue swept along the path (a free neon gradient).
 *   uniform  → a single hue for the whole stroke (still drifts with time).
 *
 * `hueSpread` stretches the gradient across more of the rainbow (>1 = several
 * cycles along the curve, <1 = a calmer band), `hueOffset` shifts the starting
 * colour, and `hueEasing` reshapes the distribution so the user can move the
 * colour density toward either end of the spline.
 */
function emitStroke(
  points, {
    iterations,
    closed,
    hueSpeed,
    hueSpread,
    hueOffset,
    hueEaseFn,
    gradient,
    weightStart,
    weightEnd,
    weightEaseFn
  }
) {
  const dense = chaikinFlat(
    points,
    iterations,
    closed
  );
  const total = dense.length / 2;
  const segments = closed ? total : total - 1;

  if ( segments < 1 ) {
    return;
  }

  const angle = animation.angle;
  const timeHue = angle * hueSpeed;
  const uniformHue = timeHue + hueOffset;
  const denom = Math.max(
    1,
    segments - ( closed ? 0 : 1 )
  );

  batch.openStroke();

  for ( let i = 0; i < segments; i++ ) {
    const ai = i * 2;
    const bi = ( ( i + 1 ) % total ) * 2;
    const t = i / denom;
    const hueIndex = gradient
      ? hueOffset + timeHue + hueEaseFn( t ) * TWO_PI * hueSpread
      : uniformHue;
    const halfFactor = _thicknessProfile(
      ( i + 0.5 ) / segments,
      weightStart,
      weightEnd,
      weightEaseFn,
      closed
    );

    batch.strokeSegment(
      dense[ ai ],
      dense[ ai + 1 ],
      dense[ bi ],
      dense[ bi + 1 ],
      hueIndex,
      halfFactor
    );
  }
}

/**
 * Uniform stroke, used for the Catmull-Rom / quadratic methods (and Chaikin
 * when the gradient is turned off). The hue still drifts with time.
 */
export function drawUniformCurve(
  points, method, {
    iterations,
    closed,
    tension,
    weight,
    glow,
    hueSpeed
  }
) {
  const p = getP5();

  p.noFill();

  for ( let shadow = glow; shadow >= 0; shadow-- ) {
    const layerWeight = weight * ( 1 + shadow * 1.3 );
    const opacityFactor = p.map(
      shadow,
      0,
      Math.max(
        1,
        glow
      ),
      1,
      4
    );

    p.strokeWeight( layerWeight );
    p.stroke( colors.rainbow( {
      hueIndex: Math.sin( animation.angle * hueSpeed ) * p.PI * 2,
      opacityFactor
    } ) );

    if ( method === "quadratic" ) {
      emitQuadraticMidpoint(
        points,
        closed
      );
    } else if ( method === "chaikin" ) {
      const dense = chaikin(
        points,
        iterations,
        closed
      );

      p.beginShape();
      dense.forEach( ( v ) => p.vertex(
        v.x,
        v.y
      ) );
      p.endShape( closed ? p.CLOSE : undefined );
    } else {
      emitCatmullRom(
        points,
        closed,
        tension
      );
    }
  }
}

/**
 * Render a batch of splines with the splines look: optional raw-polygon overlays,
 * the rounded glowing curves, then optional point markers on top. `cfg` mirrors
 * the sketch option blocks ({ curve, stroke, overlay }) and applies to every
 * spline in `list` (the rounding method and styling are shared options).
 *
 * Batching matters for the live/interactive variant: every detected entity is one
 * spline, so the per-frame glow is drawn for all of them in a single instanced GPU
 * pass instead of one CPU stroke loop per entity. Overlays and markers stay on the
 * p2d canvas (they are cheap, proportional to the original point count) and the
 * glow composites between them, preserving the overlay→curve→markers stacking.
 *
 * @param {Array<Array>} list array of point lists (each an ordered set of vectors)
 */
export function renderSplines(
  list, {
    curve = {},
    stroke = {},
    overlay = {}
  } = {}
) {
  const splines = ( list ?? [] ).filter( ( points ) => points && points.length >= 2 );

  if ( splines.length === 0 ) {
    return;
  }

  const method = curve.method ?? "chaikin";
  const closed = curve.closed ?? true;
  const polygonCfg = overlay.polygon ?? {};
  const pointsCfg = overlay.points ?? {};

  const curveOptions = {
    iterations: curve.iterations ?? 4,
    closed,
    tension: curve.tension ?? 0,
    weight: stroke.weight ?? 6,
    glow: stroke.glow ?? 3,
    hueSpeed: stroke.hueSpeed ?? 1,
    hueSpread: stroke.hueSpread ?? 1,
    hueOffset: stroke.hueOffset ?? 0,
    hueEaseFn: easing[ stroke.hueEasing ] ?? easing.linear,
    weightStart: stroke.weightStart ?? 1,
    weightEnd: stroke.weightEnd ?? 1,
    weightEaseFn: easing[ stroke.weightEasing ] ?? easing.linear
  };

  // Raw polygon overlay (behind the curve), straight onto the p2d canvas.
  if ( polygonCfg.show ?? true ) {
    splines.forEach( ( points ) => drawPolygonOverlay(
      points,
      closed,
      polygonCfg
    ) );
  }

  // The rounded glowing curve is the per-frame hotspot, so for the Chaikin methods
  // every spline's geometry is uploaded once and the GPU re-draws it per glow layer
  // (rainbow colour computed in the shader). The p5-native curve primitives
  // (catmull-rom / quadratic) stay on the CPU — they already emit one shape per glow
  // layer, so they were never the bottleneck and tessellating them would risk
  // changing their look.
  if ( method === "chaikin" ) {
    const gradient = stroke.gradient ?? true;

    batch.beginStrokes();
    splines.forEach( ( points ) => emitStroke(
      points,
      {
        iterations: curveOptions.iterations,
        closed,
        hueSpeed: curveOptions.hueSpeed,
        hueSpread: curveOptions.hueSpread,
        hueOffset: curveOptions.hueOffset,
        hueEaseFn: curveOptions.hueEaseFn,
        gradient,
        weightStart: curveOptions.weightStart,
        weightEnd: curveOptions.weightEnd,
        weightEaseFn: curveOptions.weightEaseFn
      }
    ) );
    batch.drawStrokes( {
      weight: curveOptions.weight,
      glow: curveOptions.glow
    } );
  } else {
    splines.forEach( ( points ) => drawUniformCurve(
      points,
      method,
      curveOptions
    ) );
  }

  // Markers drawn last so they stay on top of the glowing curve.
  if ( pointsCfg.show ?? true ) {
    splines.forEach( ( points ) => drawPointMarkers(
      points,
      pointsCfg
    ) );
  }
}

/**
 * Render a single spline. Thin wrapper over `renderSplines` so existing callers
 * (and the procedural v0 layout) keep working unchanged.
 */
export function renderSpline(
  points, cfg
) {
  renderSplines(
    points ? [
      points
    ] : [],
    cfg
  );
}
