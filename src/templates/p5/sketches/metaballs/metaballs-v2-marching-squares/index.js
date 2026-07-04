import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import {
  initInteraction,
  getPointers
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";
import {
  createBalls,
  animateBalls,
  combineBalls,
  buildFieldGrid,
  marchingSquaresContour,
  palette
} from "../_metaballs.js";

// ─────────────────────────────────────────────────────────────────────────────
// metaballs v2 — marching squares.
//
// The centrepiece of the article: sample the field on a grid, classify every
// 2×2 cell into one of 16 cases and stroke the iso-contour, with optional linear
// interpolation of the crossing points. Toggle the grid, the inside/outside
// sample dots and the source balls to see exactly how the algorithm works.
// ─────────────────────────────────────────────────────────────────────────────

const state = {
  balls: [],
  ballsKey: "",
  field: null
};

function ensureBalls( o ) {
  const p = getP5();
  const b = o.balls ?? {};
  const key = [
    b.count,
    b.seed,
    b.minRadius,
    b.maxRadius,
    p.width,
    p.height
  ].join( "-" );

  if ( key !== state.ballsKey ) {
    state.ballsKey = key;
    state.balls = createBalls( {
      count: b.count ?? 7,
      seed: b.seed ?? 7,
      minRadius: b.minRadius ?? 70,
      maxRadius: b.maxRadius ?? 160,
      width: p.width,
      height: p.height
    } );
  }
}

sketch.setup( async() => {
  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    8,
    8,
    14,
    255
  ] ) );

  ensureBalls( o );

  const b = o.balls ?? {};

  animateBalls(
    state.balls,
    {
      mode: b.motionMode ?? "drift",
      angle: animation.angle,
      motion: b.motion ?? 1,
      speed: b.speed ?? 1,
      radiusPulse: b.radiusPulse ?? 0.12,
      width: p.width,
      height: p.height
    }
  );

  const interaction = o.interaction ?? {};
  const mix = o.interactionMix ?? {};
  const mixMode = mix.mode ?? "add";
  const pointers = mixMode === "off" ? [] : getPointers( interaction );
  const balls = combineBalls(
    state.balls,
    pointers,
    mix.pointerRadius ?? 130,
    mixMode
  );

  if ( balls.length === 0 ) {
    drawInteractionOverlay( interaction );

    return;
  }

  const gridOpts = o.grid ?? {};
  const cellSize = Math.max(
    4,
    gridOpts.cellSize ?? 22
  );
  const threshold = gridOpts.threshold ?? 1;
  const interpolate = gridOpts.interpolate ?? true;

  const cols = Math.max(
    1,
    Math.floor( p.width / cellSize )
  );
  const rows = Math.max(
    1,
    Math.floor( p.height / cellSize )
  );
  const cellW = p.width / cols;
  const cellH = p.height / rows;

  state.field = buildFieldGrid(
    balls,
    cols,
    rows,
    cellW,
    cellH,
    state.field
  );

  const debug = o.debug ?? {};

  // Faint grid lines.
  if ( debug.showGrid ) {
    p.stroke(
      255,
      255,
      255,
      18
    );
    p.strokeWeight( 1 );

    for ( let gx = 0; gx <= cols; gx++ ) {
      const x = gx * cellW;

      p.line(
        x,
        0,
        x,
        p.height
      );
    }

    for ( let gy = 0; gy <= rows; gy++ ) {
      const y = gy * cellH;

      p.line(
        0,
        y,
        p.width,
        y
      );
    }
  }

  // Inside / outside sample dots.
  if ( debug.showSamples ) {
    const w = cols + 1;
    const dotSize = Math.min(
      cellW,
      cellH
    ) * 0.18;

    p.noStroke();

    for ( let gy = 0; gy <= rows; gy++ ) {
      for ( let gx = 0; gx <= cols; gx++ ) {
        const inside = state.field[ gy * w + gx ] > threshold;

        if ( inside ) {
          p.fill(
            120,
            230,
            170,
            230
          );
        } else {
          p.fill(
            255,
            255,
            255,
            40
          );
        }

        p.circle(
          gx * cellW,
          gy * cellH,
          dotSize
        );
      }
    }
  }

  // Source balls.
  if ( debug.showBalls ) {
    p.noFill();
    p.stroke(
      255,
      120,
      120,
      120
    );
    p.strokeWeight( 1 );

    for ( const ball of balls ) {
      p.circle(
        ball.x,
        ball.y,
        ball.r * 2
      );
    }
  }

  // The contour itself.
  const strokeOpts = o.stroke ?? {};
  const weight = strokeOpts.weight ?? 3;
  const rainbow = strokeOpts.rainbow ?? true;
  const paletteName = strokeOpts.palette ?? "rainbow";
  const hueShift = animation.progression * ( strokeOpts.hueSpeed ?? 1 );
  const solid = strokeOpts.color ?? [
    255,
    255,
    255,
    255
  ];

  p.strokeWeight( weight );
  p.strokeCap( p.ROUND );

  if ( !rainbow ) {
    p.stroke( ...solid );
  }

  const invHeight = 1 / p.height;

  marchingSquaresContour(
    state.field,
    cols,
    rows,
    cellW,
    cellH,
    threshold,
    interpolate,
    (
      x1, y1, x2, y2
    ) => {
      if ( rainbow ) {
        const t = ( ( y1 + y2 ) * 0.5 * invHeight + hueShift ) % 1;
        const rgb = palette(
          paletteName,
          t
        );

        p.stroke(
          rgb[ 0 ],
          rgb[ 1 ],
          rgb[ 2 ],
          255
        );
      }

      p.line(
        x1,
        y1,
        x2,
        y2
      );
    }
  );

  drawInteractionOverlay( interaction );
} );
