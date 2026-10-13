import {
  getP5
} from "./sketch.js";
import animation from "./animation.js";
import easing from "./easing.js";
import {
  HOUSE_PALETTE_IDS,
  PALETTES
} from "./palettes.js";
import {
  backgroundGeometry,
  isBackgroundObject,
  normalizeBackground
} from "./backgroundSpec.js";

// ─────────────────────────────────────────────────────────────────────────────
// Paints a sketch's background value (backgroundSpec.js): a colour exactly as
// `background()` always did, a gradient through the canvas's own gradient on
// P2D, and on WEBGL through a 2D buffer laid over the cleared frame without
// writing depth (a textured quad at z = 0 would otherwise hide every shape
// drawn behind it).
//
//   const background = resolveBackground( options.sketch.backgroundColor, {
//     fallback: [ 0, 0, 0 ],
//     palette: options.sketch.colors?.palette
//   } );
//   paintBackground( background );     // instead of p.background( ...colour )
//   p.fill( ...background );           // still a colour: the first stop
//
// `resolveBackground` returns a colour ARRAY in every case — the stored array
// itself for a plain colour — carrying the gradient on a `spec` property, so
// a sketch that spreads its background into `fill()` or a mask keeps working
// and a call site the migration missed paints the first colour, never throws.
// ─────────────────────────────────────────────────────────────────────────────

// The palette's paper, for a shared preset only: a colors.js house function
// has no paper, so its sketches keep their own colours.
function paperOf( palette ) {
  if ( !palette || HOUSE_PALETTE_IDS.includes( palette ) ) {
    return null;
  }

  return PALETTES[ palette ]?.paper ?? null;
}

function withAlpha(
  color, alphaFrom
) {
  return [
    color[ 0 ],
    color[ 1 ],
    color[ 2 ],
    alphaFrom?.[ 3 ] ?? 255
  ];
}

/**
 * @param {*} value the stored background: a colour array or a gradient object
 * @param {{ fallback?: number[], palette?: string }} [options]
 * @returns {number[] & { spec?: object }}
 */
export function resolveBackground(
  value, {
    fallback = [
      0,
      0,
      0
    ],
    palette
  } = {}
) {
  if ( !isBackgroundObject( value ) ) {
    return value ?? fallback;
  }

  const spec = normalizeBackground( value );
  const paper = spec.source === "palette" ? paperOf( palette ) : null;
  const from = paper ? withAlpha(
    paper.top,
    spec.from
  ) : spec.from;
  const to = paper ? withAlpha(
    paper.bottom ?? paper.top,
    spec.to
  ) : spec.to;
  const base = [
    ...from
  ];

  base.spec = {
    ...spec,
    from,
    to
  };

  return base;
}

function levels(
  target, color
) {
  return target.color( ...color ).levels;
}

function fillGradient(
  ctx, geometry, target
) {
  const gradient = geometry.kind === "radial"
    ? ctx.createRadialGradient(
      geometry.circle[ 0 ],
      geometry.circle[ 1 ],
      0,
      geometry.circle[ 0 ],
      geometry.circle[ 1 ],
      geometry.circle[ 2 ]
    )
    : ctx.createLinearGradient( ...geometry.line );

  for ( const stop of geometry.stops ) {
    const [
      r,
      g,
      b,
      a
    ] = stop.color;

    gradient.addColorStop(
      stop.offset,
      `rgba(${ r },${ g },${ b },${ a / 255 })`
    );
  }

  ctx.save();
  ctx.setTransform(
    1,
    0,
    0,
    1,
    0,
    0
  );
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = gradient;
  ctx.fillRect(
    0,
    0,
    ctx.canvas.width,
    ctx.canvas.height
  );
  ctx.restore();
}

function geometryFor(
  spec, target, width, height
) {
  return backgroundGeometry(
    spec,
    {
      width,
      height,
      phase: animation.progression,
      ease: easing[ spec.easing ] ?? easing.linear,
      // Through p5's own colour parsing, so the stops read the arrays the way
      // `background()` reads them (colour mode included).
      from: levels(
        target,
        spec.from
      ),
      to: levels(
        target,
        spec.to
      )
    }
  );
}

// One 2D buffer per WEBGL surface (the page's canvas, a layer's graphics),
// resized with it.
const buffers = new WeakMap();

function bufferFor( target ) {
  const p = getP5();
  let buffer = buffers.get( target );

  if ( !buffer || buffer.width !== target.width || buffer.height !== target.height ) {
    buffer?.remove();
    buffer = p.createGraphics(
      target.width,
      target.height
    );
    buffer.pixelDensity( target.pixelDensity() );
    buffers.set(
      target,
      buffer
    );
  }

  return buffer;
}

/**
 * @param {number[] & { spec?: object }} background resolveBackground's result
 * @param {object} [target] the p5 instance or a p5.Graphics; the page's sketch
 */
export function paintBackground(
  background, target = getP5()
) {
  const spec = background?.spec;

  if ( !spec || spec.kind === "solid" ) {
    target.background( ...background );
    return;
  }

  const ctx = target.drawingContext;

  if ( typeof CanvasRenderingContext2D !== "undefined" && ctx instanceof CanvasRenderingContext2D ) {
    fillGradient(
      ctx,
      geometryFor(
        spec,
        target,
        ctx.canvas.width,
        ctx.canvas.height
      ),
      target
    );
    return;
  }

  // WEBGL: clear colour and depth as background() does, then lay the
  // gradient over the frame in screen space without writing depth.
  target.background( ...background );

  const buffer = bufferFor( target );
  const bufferContext = buffer.drawingContext;

  bufferContext.clearRect(
    0,
    0,
    bufferContext.canvas.width,
    bufferContext.canvas.height
  );
  fillGradient(
    bufferContext,
    geometryFor(
      spec,
      target,
      bufferContext.canvas.width,
      bufferContext.canvas.height
    ),
    target
  );

  target.push();
  target.resetMatrix();
  target.noStroke();
  target.tint( 255 );
  target.imageMode( target.CENTER );
  ctx.depthMask( false );
  target.image(
    buffer,
    0,
    0,
    target.width,
    target.height
  );
  ctx.depthMask( true );
  target.pop();
}
