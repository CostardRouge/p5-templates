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
  await scene.init( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const interaction = options.sketch?.interaction ?? {};
  const physics = options.sketch?.physics ?? {};
  const visuals = options.sketch?.visuals ?? {};
  const hands = options.sketch?.hands ?? {};
  const repulse = options.sketch?.repulse ?? {};
  const text = options.sketch?.text ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.beginFrame( background );
  scene.readInteraction( interaction );
  scene.syncBoundaries();
  scene.syncBalls( {
    count: physics.ballCount ?? 51,
    sizeMin: physics.ballSizeMin ?? 20,
    sizeMax: physics.ballSizeMax ?? 50
  } );

  scene.drawInteraction( {
    innerCircleSize: hands.size ?? 50,
    shadowsCount: hands.glow ?? 3,
    vectorsStep: hands.resolution ?? 0.05
  } );
  scene.syncHandBodies( physics.handRadius ?? 75 );
  scene.repulse(
    repulse.strength ?? 0.5,
    repulse.maxForce ?? 0.02,
    repulse.distance ?? 600
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
    title: text.title ?? "repulse",
    subtitle: text.subtitle ?? "hand tracking v2",
    show: text.show ?? true,
    color: background
  } );
} );
