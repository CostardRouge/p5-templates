import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import {
  HandCaptureScene
} from "../_shared.js";

// v8 "growing" is v7's echo rebuilt on the shader-based spline pipeline (the
// same GPU glow as `splines · interactive`) instead of the legacy CPU neonLine.
// The trail itself is a cheap canvas-feedback buffer: only the live hand is
// re-tessellated each frame, while past frames are aged with a single canvas
// copy that can drift toward an edge or bloom bigger + darker behind the hand.
const scene = new HandCaptureScene();

sketch.setup( async() => {
  await scene.init( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const interaction = options.sketch?.interaction ?? {};
  const spline = options.sketch?.spline ?? {};
  const echo = options.sketch?.echo ?? {};
  const effect = options.sketch?.effect ?? {};
  const text = options.sketch?.text ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.readInteraction( interaction );

  scene.drawGrowingEcho( {
    background,
    weight: spline.weight ?? 18,
    glow: spline.glow ?? 2,
    iterations: spline.iterations ?? 6,
    hueSpeed: spline.hueSpeed ?? 1.5,
    hueSpread: spline.hueSpread ?? 2,
    decay: echo.decay ?? 0.9,
    effect: effect.type ?? "up",
    speed: effect.speed ?? 8,
    scale: effect.scale ?? 1.03,
    darken: effect.darken ?? 0.12
  } );

  scene.drawTitle( {
    title: text.title ?? "growing",
    subtitle: text.subtitle ?? "hand tracking v8",
    show: text.show ?? true,
    color: background
  } );
} );
