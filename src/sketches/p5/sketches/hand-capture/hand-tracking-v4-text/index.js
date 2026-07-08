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
  const text = options.sketch?.text ?? {};
  const physics = options.sketch?.physics ?? {};
  const letters = options.sketch?.letters ?? {};
  const visuals = options.sketch?.visuals ?? {};
  const hands = options.sketch?.hands ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.beginFrame( background );
  scene.readInteraction( interaction );
  scene.syncBoundaries();
  scene.syncLetters( {
    text: text.content ?? "abcdefghijklmnopqrstuvwxyz0123456789",
    restitution: letters.restitution ?? 0.4,
    friction: letters.friction ?? 0.1
  } );

  scene.drawInteraction( {
    innerCircleSize: hands.size ?? 50,
    shadowsCount: hands.glow ?? 3,
    vectorsStep: hands.resolution ?? 0.05
  } );
  scene.syncHandBodies( physics.handRadius ?? 75 );
  scene.restoreLetters(
    letters.restoreStrength ?? 0.0001,
    letters.restoreMaxForce ?? 0.003
  );
  scene.update();
  scene.containLetters();

  scene.renderBalls( {
    shadowsCount: visuals.shadowsCount ?? 3,
    dotScale: visuals.dotScale ?? 1
  } );
  scene.renderLetters( {
    size: text.letterSize ?? 144
  } );
  scene.compose();
} );
