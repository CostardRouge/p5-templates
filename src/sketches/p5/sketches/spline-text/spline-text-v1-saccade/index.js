import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  renderReadingSplineText
} from "../_reading.js";

// A spline cluster that reads a paragraph, resting on a word then travelling to
// the next, word by word over the full background text. The transition is chosen
// at runtime via `flow.mode`: "progressive" morphs the cluster from word to word
// while "instant" snaps it onto each word (a jump per word). Behaviour lives in
// _reading.js; this entry only wires options into the engine.
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
