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
  const attract = options.sketch?.attract ?? {};
  const text = options.sketch?.text ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.beginFrame( background );
  scene.syncBoundaries();
  scene.syncBalls( {
    count: physics.ballCount ?? 51,
    sizeMin: physics.ballSizeMin ?? 20,
    sizeMax: physics.ballSizeMax ?? 50
  } );

  scene.traceHands();
  scene.syncHandBodies( physics.handRadius ?? 75 );
  scene.attract(
    attract.strength ?? 0.0005,
    attract.maxForce ?? 0.002
  );
  scene.update();
  scene.containBalls();

  scene.setTrail( visuals.trail ?? 10 );
  scene.renderBalls( {
    shadowsCount: visuals.shadowsCount ?? 3,
    dotScale: visuals.dotScale ?? 1
  } );
  scene.compose();

  scene.drawTitle( {
    title: text.title ?? "attract",
    subtitle: text.subtitle ?? "hand tracking v1",
    show: text.show ?? true,
    color: background
  } );
} );
