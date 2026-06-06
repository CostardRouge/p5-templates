import {
  getP5
} from "@/p5/utils/sketch.js";

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
