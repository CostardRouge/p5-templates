import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import {
  HandCaptureScene
} from "../_shared.js";
import renderLegacyTitle from "@/p5/utils/title/renderLegacyTitle.js";

const scene = new HandCaptureScene( {
  layers: {
    hands: {}
  }
} );

sketch.setup( async() => {
  await scene.init( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const interaction = options.sketch?.interaction ?? {};
  const handDrawing = options.sketch?.hands ?? {};
  const echo = options.sketch?.echo ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.beginFrame( background );
  scene.readInteraction( interaction );

  scene.drawEchoes( {
    count: echo.count ?? 6,
    spacing: echo.spacing ?? 4,
    minAlpha: echo.minAlpha ?? 0.1,
    ghostAlpha: echo.ghostAlpha ?? 0.55,
    innerCircleSize: handDrawing.size ?? 30,
    shadowsCount: handDrawing.glow ?? 2,
    vectorsStep: handDrawing.resolution ?? 0.08
  } );
  scene.compose();

  renderLegacyTitle( {
    title: options.sketch?.title ?? "",
    subtitle: options.sketch?.subtitle ?? "",
    color: background
  } );
} );
