import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  renderScribe
} from "../_shared.js";

// A single pen travels the outline of each letter while the camera tracks the
// tip — the "writing" POV. The lines can be drawn as the pen passes or already
// be there (camera-only travel), it can follow every letter or stay on one, and
// it pulls back at the end to reveal the whole word. All behaviour lives in
// _shared.js; this entry only wires options into the engine.
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

  renderScribe( o );
} );
