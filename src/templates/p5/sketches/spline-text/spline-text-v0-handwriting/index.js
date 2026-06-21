import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  renderSplineText
} from "../_shared.js";

// A random, drifting spline that gathers letter by letter onto the word (the
// progressive "handwriting" reveal) and then releases back to the cloud. All of
// the behaviour lives in _shared.js; this variant only sets the defaults.
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
