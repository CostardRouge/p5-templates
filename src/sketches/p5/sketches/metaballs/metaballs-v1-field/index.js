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
  sampleField,
  palette,
  fieldToUnit
} from "../_metaballs.js";

// ─────────────────────────────────────────────────────────────────────────────
// metaballs v1 — scalar field.
//
// The raw metaball influence field f(x,y) = Σ rᵢ²/dᵢ² rendered straight to a
// low-resolution buffer (one sample per buffer-pixel) and scaled up smoothly.
// This is the "what is a metaball" view that everything else thresholds.
// ─────────────────────────────────────────────────────────────────────────────

const state = {
  balls: [],
  ballsKey: "",
  buffer: null,
  bufW: 0,
  bufH: 0
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

function ensureBuffer( cols ) {
  const p = getP5();
  const bufW = Math.max(
    16,
    Math.round( cols )
  );
  const bufH = Math.max(
    16,
    Math.round( cols * ( p.height / p.width ) )
  );

  if ( !state.buffer || bufW !== state.bufW || bufH !== state.bufH ) {
    state.buffer = p.createGraphics(
      bufW,
      bufH
    );
    state.buffer.pixelDensity( 1 );
    state.bufW = bufW;
    state.bufH = bufH;
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
    0,
    0,
    0,
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

  const render = o.render ?? {};
  const threshold = o.grid?.threshold ?? 1;
  const gamma = render.gamma ?? 1;
  const paletteName = render.palette ?? "magma";
  const insideBoost = render.insideBoost ?? 0.25;
  const outsideDim = render.outsideDim ?? 0.65;

  ensureBuffer( render.resolution ?? 220 );

  const g = state.buffer;
  const bufW = state.bufW;
  const bufH = state.bufH;
  const scaleX = p.width / bufW;
  const scaleY = p.height / bufH;

  g.loadPixels();

  const px = g.pixels;

  for ( let y = 0; y < bufH; y++ ) {
    const wy = y * scaleY;

    for ( let x = 0; x < bufW; x++ ) {
      const value = sampleField(
        balls,
        x * scaleX,
        wy
      );
      const inside = value > threshold;
      const t = fieldToUnit(
        value,
        threshold,
        gamma
      );
      const rgb = palette(
        paletteName,
        t
      );
      const k = inside ? 1 + insideBoost : outsideDim;
      const i = ( y * bufW + x ) * 4;

      px[ i ] = rgb[ 0 ] * k;
      px[ i + 1 ] = rgb[ 1 ] * k;
      px[ i + 2 ] = rgb[ 2 ] * k;
      px[ i + 3 ] = 255;
    }
  }

  g.updatePixels();

  p.push();
  p.image(
    g,
    0,
    0,
    p.width,
    p.height
  );
  p.pop();

  if ( render.showBalls ) {
    p.noFill();
    p.stroke(
      255,
      255,
      255,
      140
    );
    p.strokeWeight( 1.5 );

    for ( const ball of balls ) {
      p.circle(
        ball.x,
        ball.y,
        ball.r * 2
      );
      p.point(
        ball.x,
        ball.y
      );
    }
  }

  drawInteractionOverlay( interaction );
} );
