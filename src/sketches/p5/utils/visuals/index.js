// ── Kept on purpose, currently unreferenced ───────────────────────────────
//
// These were the bodies behind the "visual" content item, which is gone: three
// of its four options never rendered (neon-line threw on a missing getP5
// import, neon-dot and churros-snake were called without the arguments they
// need) and the survivor, neon-graffiti, already exists as a real sketch. Now
// that any sketch can be a layer, a bespoke visual layer earns nothing.
//
// The MATH is worth keeping: each of these is a sketch waiting to be written,
// and the plan is to migrate them one at a time into src/sketches/p5/sketches/
// where they can be picked as layers like everything else. So nothing here is
// imported anywhere today — that is expected, not dead weight to sweep.
//
// Each takes the arguments a real caller would pass (vectors, a position); a
// sketch built from one supplies them from its own draw.

import neonGraffiti from "./neonGraffiti.js";
import neonLine from "./neonLine.js";
import neonDot from "./neonDot.js";

const visualsMap = {
  "neon-graffiti": neonGraffiti,
  "neon-line": neonLine,
  "neon-dot": neonDot
};

export default visualsMap;
