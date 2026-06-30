import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  renderCurrent
} from "../_shared.js";

// One pen follows the outline like the scribe, but the camera also ROTATES the
// world so the trace always flows toward a fixed screen direction (a 2D vector):
// the pen sits still on an "on-rails" anchor and the letter streams and swivels
// past it, then un-rotates and pulls back to reveal the upright word at the end.
// All behaviour lives in _shared.js; this entry only wires options into it.
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

  renderCurrent( o );
} );
