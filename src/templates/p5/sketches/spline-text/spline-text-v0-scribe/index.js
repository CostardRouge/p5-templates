import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  renderSplineText
} from "../_shared.js";

// A random, drifting spline that gathers onto a single word and then releases
// back to the cloud. The reveal mode is chosen at runtime via `morph.mode`:
// "progressive" writes it letter by letter (the handwriting look) while
// "instant" snaps every control point onto the word at once. All of the
// behaviour lives in _shared.js; this entry only wires options into the engine.
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

  renderSplineText( o );
} );
