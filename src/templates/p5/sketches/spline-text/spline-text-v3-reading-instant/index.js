import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  renderReadingSplineText
} from "../_reading.js";

// Same paragraph-reading flow as v2 but the cluster snaps onto each word and
// jumps word to word with no in-between morph (the "instant" mode). Behaviour
// lives in _reading.js; this variant only sets flow.mode = "instant".
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
