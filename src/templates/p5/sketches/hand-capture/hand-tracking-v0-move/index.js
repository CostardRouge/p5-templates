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
  const text = options.sketch?.text ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.beginFrame( background );
  scene.readInteraction( interaction );
  scene.syncBoundaries();
  scene.syncBalls( {
    count: physics.ballCount ?? 26,
    sizeMin: physics.ballSizeMin ?? 50,
    sizeMax: physics.ballSizeMax ?? 80
  } );

  scene.drawInteraction( {
    innerCircleSize: hands.size ?? 50,
    shadowsCount: hands.glow ?? 3,
    vectorsStep: hands.resolution ?? 0.05
  } );
  scene.syncHandBodies( physics.handRadius ?? 75 );
  scene.setGravity( {
    x: physics.gravity?.x ?? 0,
    y: physics.gravity?.y ?? 0
  } );
  scene.update();
  scene.containBalls();

  scene.setTrail( visuals.trail ?? 10 );
  scene.renderBalls( {
    shadowsCount: visuals.shadowsCount ?? 3,
    dotScale: visuals.dotScale ?? 1
  } );
  scene.compose();

  scene.drawTitle( {
    title: text.title ?? "move",
    subtitle: text.subtitle ?? "hand tracking v0",
    show: text.show ?? true,
    color: background
  } );
} );
