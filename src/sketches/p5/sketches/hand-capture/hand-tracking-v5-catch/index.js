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

// Running tallies for the implicit score. Persist across frames; reset on reload.
let caught = 0;
let missed = 0;

sketch.setup( async() => {
  await scene.init( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const interaction = options.sketch?.interaction ?? {};
  const rain = options.sketch?.rain ?? {};
  const handDrawing = options.sketch?.hands ?? {};
  const grab = options.sketch?.catch ?? {};
  const visuals = options.sketch?.visuals ?? {};
  const score = options.sketch?.score ?? {};
  const text = options.sketch?.text ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.beginFrame( background );
  scene.readInteraction( interaction );
  scene.setGravity( {
    x: 0,
    y: rain.gravity ?? 1
  } );
  scene.spawnRain( {
    rate: rain.spawnRate ?? 6,
    sizeMin: rain.dropSizeMin ?? 20,
    sizeMax: rain.dropSizeMax ?? 40
  } );
  scene.update();

  caught += scene.catchNearPointers( {
    radius: grab.radius ?? 70
  } );
  missed += scene.cullOffscreen( {
    margin: 120
  } );

  scene.drawInteraction( {
    innerCircleSize: handDrawing.size ?? 50,
    shadowsCount: handDrawing.glow ?? 3,
    vectorsStep: handDrawing.resolution ?? 0.05
  } );
  scene.setTrail( visuals.trail ?? 40 );
  scene.renderBalls( {
    shadowsCount: visuals.shadowsCount ?? 3,
    dotScale: visuals.dotScale ?? 1
  } );
  scene.compose();

  scene.drawScore( {
    value: caught,
    label: `${ missed } missed`,
    show: score.show ?? true,
    color: background
  } );
  scene.drawTitle( {
    subtitle: text.subtitle ?? "catch · hand tracking v5",
    show: text.show ?? true,
    color: background
  } );
} );
