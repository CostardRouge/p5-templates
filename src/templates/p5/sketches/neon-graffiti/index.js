import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import {
  getP5
} from "@/p5/utils/sketch.js";
import neonGraffiti from "@/p5/utils/visuals/neonGraffiti.js";

sketch.draw( ( _time ) => {
  const p = getP5();

  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );
  neonGraffiti( {
    amplitude: options.sketch.amplitude,
    shadowsCount: options.sketch.shadowsCount,
    stepsCount: options.sketch.stepsCount,
    size: options.sketch.size,
    stepAngleAmplitude: options.sketch.stepAngleAmplitude,
    sinAmplitudeMultiplier: options.sketch.sinAmplitudeMultiplier,
    cosAmplitudeMultiplier: options.sketch.cosAmplitudeMultiplier,
    sinAngleMultiplier: options.sketch.sinAngleMultiplier,
    cosAngleMultiplier: options.sketch.cosAngleMultiplier,
    hueIndexMultiplier: options.sketch.hueIndexMultiplier,
    hueAmplitude: options.sketch.hueAmplitude,
    positionSinEasing: options.sketch.positionSinEasing,
    positionCosEasing: options.sketch.positionCosEasing,
    positionCosMultiplier: options.sketch.positionCosMultiplier,
    hueEasing: options.sketch.hueEasing,
    hueStepDivider: options.sketch.hueStepDivider,
    opacityStart: options.sketch.opacityStart,
    opacityEnd: options.sketch.opacityEnd,
    start: p.createVector(
      p.width * options.sketch.start.x,
      p.height * options.sketch.start.y
    ),
    end: p.createVector(
      p.width * options.sketch.end.x,
      p.height * options.sketch.end.y
    )
  } );
} );
