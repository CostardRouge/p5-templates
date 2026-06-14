import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import {
  HandCaptureScene
} from "../_shared.js";

const scene = new HandCaptureScene( {
  layers: {
    visuals: {},
    hands: {}
  }
} );

sketch.setup( async() => {
  await scene.init();
} );

sketch.draw( () => {
  const physics = options.sketch?.physics ?? {};
  const visuals = options.sketch?.visuals ?? {};
  const restore = options.sketch?.restore ?? {};
  const text = options.sketch?.text ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.beginFrame( background );
  scene.syncBoundaries();
  scene.syncBalls( {
    count: physics.ballCount ?? 50,
    sizeMin: physics.ballSizeMin ?? 40,
    sizeMax: physics.ballSizeMax ?? 60
  } );

  scene.traceHands();
  scene.syncHandBodies( physics.handRadius ?? 75 );
  scene.restoreBalls(
    restore.strength ?? 0.01,
    restore.maxForce ?? 0.003
  );
  scene.update();
  scene.containBalls();

  scene.renderBalls( {
    shadowsCount: visuals.shadowsCount ?? 3,
    dotScale: visuals.dotScale ?? 1
  } );
  scene.compose();

  scene.drawTitle( {
    title: text.title ?? "restore",
    subtitle: text.subtitle ?? "hand tracking v3",
    show: text.show ?? true,
    color: background
  } );
} );
