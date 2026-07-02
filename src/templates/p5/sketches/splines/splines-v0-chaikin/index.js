import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import {
  buildBasePoints,
  animatePoints,
  scaleAboutCenter,
  renderSpline
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
  p.strokeCap( p.ROUND );
  p.strokeJoin( p.ROUND );

  const pointsOptions = o.points ?? {};
  const seed = ensureBasePoints( pointsOptions );

  // Loop-exact clock: animatePoints() samples noise on cos/sin(angle * speed)
  // (see splines/_shared.js), which only returns to its start position when
  // `speed` is a WHOLE number of turns per loop — snapped here at the call
  // site (_shared.js is shared with other families, so its contract stays
  // untouched).
  const motionTurns = Math.round( pointsOptions.speed ?? 1 );
  const points = scaleAboutCenter(
    animatePoints(
      state.basePoints,
      {
        motion: pointsOptions.motion ?? 0.05,
        speed: motionTurns,
        seed,
        angle: animation.angle
      }
    ),
    pointsOptions.scale ?? 1
  );

  if ( points.length < 2 ) {
    return;
  }

  // Same reasoning for the stroke's hue scroll (renderSplines/emitStroke
  // multiplies animation.angle by hueSpeed directly), so it's snapped to
  // whole cycles per loop here too.
  const strokeOptions = o.stroke ?? {};
  const hueCycles = Math.round( strokeOptions.hueSpeed ?? 1 );

  // The rounding strategy, stroke styling and demonstration overlay all live in
  // renderSpline so the interactive variant shares exactly the same look.
  renderSpline(
    points,
    {
      curve: o.curve ?? {},
      stroke: {
        ...strokeOptions,
        hueSpeed: hueCycles
      },
      overlay: o.overlay ?? {}
    }
  );
} );
