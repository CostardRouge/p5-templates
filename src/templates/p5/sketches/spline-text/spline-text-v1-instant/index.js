import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  renderSplineText
} from "../_shared.js";

// Same engine as v0 but the control points snap onto the word all at once (the
// "instant" mode). Behaviour lives in _shared.js; this variant only sets the
// defaults (morph.mode = "instant").
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
