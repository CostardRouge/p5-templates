import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
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
  marchingSquaresFill,
  palette
} from "../_metaballs.js";

// ─────────────────────────────────────────────────────────────────────────────
// metaballs v4 — iso-contour bands.
//
// Run marching squares at several thresholds of the same field to get nested
// iso-lines — a topographic map of the metaballs. Fill the bands with a palette
// (painted outer→inner so each level overpaints the last) and/or stroke the
// contour lines on top. Levels are spaced geometrically because the field grows
// fast near the centres.
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
    4,
    6,
    16,
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
    renderTitle();

    return;
  }

  const gridOpts = o.grid ?? {};
  const cellSize = Math.max(
    4,
    gridOpts.cellSize ?? 16
  );
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

  const bands = o.bands ?? {};
  const count = Math.max(
    1,
    Math.round( bands.count ?? 8 )
  );
  const minLevel = Math.max(
    0.05,
    bands.minLevel ?? 0.35
  );
  const maxLevel = Math.max(
    minLevel + 0.01,
    bands.maxLevel ?? 4
  );
  const paletteName = bands.palette ?? "viridis";
  const hueShift = animation.progression * ( bands.hueSpeed ?? 0 );
  const fillBands = bands.fill ?? true;
  const showLines = bands.lines ?? true;
  const lineWeight = bands.lineWeight ?? 1.5;
  const ratio = maxLevel / minLevel;

  const levelAt = ( i ) =>
    minLevel * Math.pow(
      ratio,
      count === 1 ? 0 : i / ( count - 1 )
    );

  // Filled bands, outer (lowest level) first so inner levels overpaint.
  if ( fillBands ) {
    p.noStroke();

    for ( let i = 0; i < count; i++ ) {
      const t = ( i / Math.max(
        1,
        count - 1
      ) + hueShift ) % 1;
      const rgb = palette(
        paletteName,
        t
      );

      p.fill(
        rgb[ 0 ],
        rgb[ 1 ],
        rgb[ 2 ],
        255
      );

      marchingSquaresFill(
        state.field,
        cols,
        rows,
        cellW,
        cellH,
        levelAt( i ),
        interpolate,
        ( verts ) => {
          p.beginShape();

          for ( let v = 0; v < verts.length; v += 2 ) {
            p.vertex(
              verts[ v ],
              verts[ v + 1 ]
            );
          }

          p.endShape( p.CLOSE );
        }
      );
    }
  }

  // Contour lines on top.
  if ( showLines ) {
    p.noFill();
    p.strokeWeight( lineWeight );
    p.strokeCap( p.ROUND );

    for ( let i = 0; i < count; i++ ) {
      if ( fillBands ) {
        p.stroke(
          255,
          255,
          255,
          50
        );
      } else {
        const t = ( i / Math.max(
          1,
          count - 1
        ) + hueShift ) % 1;
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

      marchingSquaresContour(
        state.field,
        cols,
        rows,
        cellW,
        cellH,
        levelAt( i ),
        interpolate,
        (
          x1, y1, x2, y2
        ) => {
          p.line(
            x1,
            y1,
            x2,
            y2
          );
        }
      );
    }
  }

  drawInteractionOverlay( interaction );
  renderTitle();
} );
