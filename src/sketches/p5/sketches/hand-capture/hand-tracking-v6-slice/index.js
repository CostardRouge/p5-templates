import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import {
  HandCaptureScene
} from "../_shared.js";
import renderLegacyTitle from "@/p5/utils/title/renderLegacyTitle.js";

const scene = new HandCaptureScene( {
  layers: {
    visuals: {},
    hands: {}
  }
} );

// Running tallies for the implicit score. Persist across frames; reset on reload.
let sliced = 0;
let missed = 0;

sketch.setup( async() => {
  await scene.init( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const interaction = options.sketch?.interaction ?? {};
  const toss = options.sketch?.toss ?? {};
  const blade = options.sketch?.slice ?? {};
  const handDrawing = options.sketch?.hands ?? {};
  const visuals = options.sketch?.visuals ?? {};
  const score = options.sketch?.score ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.beginFrame( background );
  scene.readInteraction( interaction );
  scene.setGravity( {
    x: 0,
    y: toss.gravity ?? 0.7
  } );
  scene.tossBalls( {
    rate: toss.spawnRate ?? 1.2,
    sizeMin: toss.fruitSizeMin ?? 45,
    sizeMax: toss.fruitSizeMax ?? 75,
    speed: toss.speed ?? 30
  } );
  scene.update();

  sliced += scene.sliceBalls( {
    minSpeed: blade.swipeSpeed ?? 25,
    bladeWidth: blade.bladeWidth ?? 20,
    minRadius: blade.minPiece ?? 16,
    splitSpeed: blade.splitSpeed ?? 6
  } );
  missed += scene.cullOffscreen( {
    margin: 220
  } );

  scene.setHandTrail( blade.bladeTrail ?? 60 );
  scene.drawInteraction( {
    innerCircleSize: handDrawing.size ?? 30,
    shadowsCount: handDrawing.glow ?? 2,
    vectorsStep: handDrawing.resolution ?? 0.08
  } );
  scene.setTrail( visuals.trail ?? 40 );
  scene.renderBalls( {
    shadowsCount: visuals.shadowsCount ?? 3,
    dotScale: visuals.dotScale ?? 1
  } );
  scene.compose();

  scene.drawScore( {
    value: sliced,
    label: `${ missed } missed`,
    show: score.show ?? true,
    color: background
  } );
  renderLegacyTitle( {
    title: options.sketch?.title ?? "",
    subtitle: options.sketch?.subtitle ?? "",
    color: background
  } );
} );
