import options from "../../utils/options.js";
import sketch from "../../utils/sketch.js";
import neonGraffiti from "../../utils/visuals/neonGraffiti.js";

sketch.setup( () => {

}, );

sketch.draw( (
  _time
) => {
  background( ...( options.sketch.backgroundColor ?? [0] ))
  neonGraffiti( {
    amplitude: options.sketch.amplitude,
    shadowsCount: options.sketch.shadowsCount,
    stepsCount: options.sketch.stepsCount,
    innerCircleSize: options.sketch.innerCircleSize,
    stepAngleAmplitude: options.sketch.stepAngleAmplitude,
    sinAmplitudeMultiplier: options.sketch.sinAmplitudeMultiplier,
    cosAmplitudeMultiplier: options.sketch.cosAmplitudeMultiplier,
    sinAngleMultiplier: options.sketch.sinAngleMultiplier,
    cosAngleMultiplier: options.sketch.cosAngleMultiplier,
    hueIndexMultiplier: options.sketch.hueIndexMultiplier,
    hueAmplitude: options.sketch.hueAmplitude,
    start: createVector(
      width * options.sketch.start.x,
      height * options.sketch.start.y
    ),
    end: createVector(
      width * options.sketch.end.x,
      height * options.sketch.end.y
    )
  } );
} );
