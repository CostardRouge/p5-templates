import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import {
  HandCaptureScene
} from "../_shared.js";

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
    title: text.title ?? "echo",
    subtitle: text.subtitle ?? "hand tracking v7",
    show: text.show ?? true,
    color: background
  } );
} );
