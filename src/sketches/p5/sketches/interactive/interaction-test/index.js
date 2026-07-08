import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  initInteraction
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";

// The whole sketch IS the debug overlay: clear, paint the background, then let
// the shared overlay draw every visualisation the form exposes.

sketch.setup( async() => {
  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const interaction = options.sketch?.interaction ?? {};
  const bg = options.sketch?.backgroundColor ?? [
    20,
    20,
    20
  ];

  p.clear();
  p.background( ...bg );

  drawInteractionOverlay( interaction );
} );
