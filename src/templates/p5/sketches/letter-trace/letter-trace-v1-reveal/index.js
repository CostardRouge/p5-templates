import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  renderReveal
} from "../_shared.js";

// The whole word in view, several pens per outline drawing at once — the word
// materialises out of nothing and "completes" from several points. The pens can
// start at the same seam or scattered (chaotic), the letters can reveal together
// or stagger left → right, and the whole thing assembles, holds and dissolves so
// the loop is seamless. All behaviour lives in _shared.js.
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

  renderReveal( o );
} );
