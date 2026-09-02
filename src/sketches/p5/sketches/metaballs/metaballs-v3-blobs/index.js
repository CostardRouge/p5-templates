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
  marchingSquaresFill,
  marchingSquaresContour,
  palette
} from "../_metaballs.js";

// ─────────────────────────────────────────────────────────────────────────────
// metaballs v3 — gooey blobs.
//
// Marching squares with the *filled* inside polygon of every cell, interpolated
// for a crisp vector edge. Fill solid or with a vertical palette gradient, add a
// glowing additive outline, and the classic "lava-lamp" metaball look falls out.
// ─────────────────────────────────────────────────────────────────────────────

const state = sketch.state( () => ( {
  balls: [],
  ballsKey: "",
  field: null
} ) );

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
    6,
    4,
    12,
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
    gridOpts.cellSize ?? 16
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

  const fillOpts = o.fill ?? {};
  const gradient = fillOpts.gradient ?? true;
  const paletteName = fillOpts.palette ?? "fire";
  const hueShift = animation.progression * ( fillOpts.hueSpeed ?? 0.5 );
  const solid = fillOpts.color ?? [
    120,
    180,
    255,
    255
  ];
  const invHeight = 1 / p.height;

  p.noStroke();

  if ( !gradient ) {
    p.fill( ...solid );
  }

  marchingSquaresFill(
    state.field,
    cols,
    rows,
    cellW,
    cellH,
    threshold,
    interpolate,
    ( verts ) => {
      if ( gradient ) {
        let sy = 0;
        const n = verts.length / 2;

        for ( let i = 1; i < verts.length; i += 2 ) {
          sy += verts[ i ];
        }

        const t = ( sy / n * invHeight + hueShift ) % 1;
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
      }

      p.beginShape();

      for ( let i = 0; i < verts.length; i += 2 ) {
        p.vertex(
          verts[ i ],
          verts[ i + 1 ]
        );
      }

      p.endShape( p.CLOSE );
    }
  );

  // Glowing additive outline.
  const outline = o.outline ?? {};
  const glow = outline.glow ?? 3;
  const outlineWeight = outline.weight ?? 2;
  const outlineColor = outline.color ?? [
    255,
    255,
    255,
    255
  ];

  if ( outlineWeight > 0 || glow > 0 ) {
    p.noFill();
    p.strokeCap( p.ROUND );
    p.strokeJoin( p.ROUND );

    const drawOutline = (
      weight, alpha, additive
    ) => {
      if ( additive ) {
        p.blendMode( p.ADD );
      }

      p.strokeWeight( weight );
      p.stroke(
        outlineColor[ 0 ],
        outlineColor[ 1 ],
        outlineColor[ 2 ],
        alpha
      );

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
          p.line(
            x1,
            y1,
            x2,
            y2
          );
        }
      );

      if ( additive ) {
        p.blendMode( p.BLEND );
      }
    };

    for ( let i = 0; i < glow; i++ ) {
      const k = ( i + 1 ) / Math.max(
        1,
        glow
      );

      drawOutline(
        outlineWeight + k * 14,
        40 * ( 1 - k ),
        true
      );
    }

    if ( outlineWeight > 0 ) {
      drawOutline(
        outlineWeight,
        outlineColor[ 3 ] ?? 255,
        false
      );
    }
  }

  drawInteractionOverlay( interaction );
} );
