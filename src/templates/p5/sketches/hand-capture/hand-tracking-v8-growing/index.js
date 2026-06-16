import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import {
  HandCaptureScene
} from "../_shared.js";

// v8 "growing" is v7's echo rebuilt on the shader-based spline pipeline (the
// same GPU glow as `splines · interactive`) instead of the legacy CPU neonLine,
// with a directional growth that lets the whole echo trail extend toward an edge
// of the canvas like a comet streak. v7 keeps the original CPU renderer.
const scene = new HandCaptureScene();

sketch.setup( async() => {
  await scene.init( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const interaction = options.sketch?.interaction ?? {};
  const spline = options.sketch?.spline ?? {};
  const echo = options.sketch?.echo ?? {};
  const extend = options.sketch?.extend ?? {};
  const text = options.sketch?.text ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.beginFrame( background );
  scene.readInteraction( interaction );

  scene.drawEchoSplines( {
    count: echo.count ?? 6,
    spacing: echo.spacing ?? 4,
    minAlpha: echo.minAlpha ?? 0.1,
    ghostAlpha: echo.ghostAlpha ?? 0.55,
    weight: spline.weight ?? 18,
    glow: spline.glow ?? 2,
    iterations: spline.iterations ?? 6,
    hueSpeed: spline.hueSpeed ?? 1.5,
    hueSpread: spline.hueSpread ?? 2,
    extend: {
      enabled: extend.enabled ?? true,
      direction: extend.direction ?? "up",
      distance: extend.distance ?? 220,
      easing: extend.easing ?? "easeOutCubic"
    }
  } );

  scene.drawTitle( {
    title: text.title ?? "growing",
    subtitle: text.subtitle ?? "hand tracking v8",
    show: text.show ?? true,
    color: background
  } );
} );
