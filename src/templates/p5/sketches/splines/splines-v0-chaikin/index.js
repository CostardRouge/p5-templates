import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import animation from "@/p5/utils/animation.js";
import {
  buildBasePoints,
  animatePoints,
  chaikin,
  emitCatmullRom,
  emitQuadraticMidpoint,
  dashedLine
} from "../_shared.js";

// Base (un-animated) point layout is only rebuilt when the relevant options or
// the canvas size change — same trick the neon spirals use with their grid.
const state = {
  basePoints: [],
  key: ""
};

function ensureBasePoints( pointsOptions ) {
  const p = getP5();
  const count = pointsOptions.count ?? 6;
  const seed = pointsOptions.seed ?? 1;
  const layout = pointsOptions.layout ?? "random";
  const key = `${ count }-${ seed }-${ layout }-${ p.width }x${ p.height }`;

  if ( key !== state.key ) {
    state.key = key;
    state.basePoints = buildBasePoints( {
      count,
      seed,
      layout
    } );
  }

  return seed;
}

// The faint angular polygon: the "before" half of the demo, so the rounded
// curve has something obvious to be compared against. Solid or dashed.
function drawPolygonOverlay(
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

// The original points as markers (outer disc + inner core), kept on top of the
// glowing curve. `size` is the general point diameter in pixels.
function drawPointMarkers(
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

// Chaikin gives us a dense polyline, so we can stroke it segment by segment and
// get a free neon-style gradient running along the path.
function drawChaikinGradient(
  points, {
    iterations,
    closed,
    weight,
    glow,
    hueSpeed
  }
) {
  const p = getP5();
  const dense = chaikin(
    points,
    iterations,
    closed
  );
  const total = dense.length;
  const segments = closed ? total : total - 1;

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

    for ( let i = 0; i < segments; i++ ) {
      const a = dense[ i ];
      const b = dense[ ( i + 1 ) % total ];
      const progression = i / segments;

      p.stroke( colors.rainbow( {
        hueIndex: Math.sin( progression * p.TAU + animation.angle * hueSpeed ) * p.PI * 2,
        opacityFactor
      } ) );
      p.line(
        a.x,
        a.y,
        b.x,
        b.y
      );
    }
  }
}

// Uniform stroke, used for the Catmull-Rom / quadratic methods (and Chaikin
// when the gradient is turned off). The hue still drifts with time.
function drawUniformCurve(
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

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );
  p.strokeCap( p.ROUND );
  p.strokeJoin( p.ROUND );

  const pointsOptions = o.points ?? {};
  const seed = ensureBasePoints( pointsOptions );
  const points = animatePoints(
    state.basePoints,
    {
      motion: pointsOptions.motion ?? 0.05,
      speed: pointsOptions.speed ?? 1,
      seed,
      angle: animation.angle
    }
  );

  if ( points.length < 2 ) {
    return;
  }

  const curve = o.curve ?? {};
  const method = curve.method ?? "chaikin";
  const closed = curve.closed ?? true;

  const stroke = o.stroke ?? {};
  const overlay = o.overlay ?? {};
  const polygonCfg = overlay.polygon ?? {};
  const pointsCfg = overlay.points ?? {};

  const curveOptions = {
    iterations: curve.iterations ?? 4,
    closed,
    tension: curve.tension ?? 0,
    weight: stroke.weight ?? 6,
    glow: stroke.glow ?? 3,
    hueSpeed: stroke.hueSpeed ?? 1
  };

  if ( polygonCfg.show ?? true ) {
    drawPolygonOverlay(
      points,
      closed,
      polygonCfg
    );
  }

  if ( method === "chaikin" && ( stroke.gradient ?? true ) ) {
    drawChaikinGradient(
      points,
      curveOptions
    );
  } else {
    drawUniformCurve(
      points,
      method,
      curveOptions
    );
  }

  // Points drawn last so the markers stay on top of the glowing curve.
  if ( pointsCfg.show ?? true ) {
    drawPointMarkers(
      points,
      pointsCfg
    );
  }
} );
