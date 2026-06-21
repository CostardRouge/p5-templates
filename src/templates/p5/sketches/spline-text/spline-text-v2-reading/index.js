import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  renderReadingSplineText
} from "../_reading.js";

// A spline cluster that reads a paragraph: it rests on a word, then morphs onto
// the next (the points unrolling from one end of the curve), travelling word by
// word over the full background text. Behaviour lives in _reading.js; this
// variant only sets the progressive defaults.
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

  renderReadingSplineText( o );
} );
