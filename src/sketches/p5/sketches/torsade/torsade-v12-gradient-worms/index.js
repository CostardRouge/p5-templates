import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import {
  SpiralBase, rebuildGrid
} from "../_shared.js";

const sketchState = sketch.state( () => ( {
  shapes: [],
  lastLayout: ""
} ) );

class Spiral extends SpiralBase {
  draw(
    time, index
  ) {
    const p = getP5();
    const o = options.sketch ?? {};
    const spiralOpts = o.spiral ?? {};
    const motion = o.motion ?? {};
    const colorOpts = o.colors ?? {};

    const {
      position, size, start, end
    } = this;

    const timeSpeed = motion.timeSpeed ?? 1;
    const hueCadence = index + time * ( colorOpts.hueSpeed ?? 1 );
    const t = p.sin( time * timeSpeed );
    const mult = p.map(
      t,
      -1,
      1,
      spiralOpts.waveMultMin ?? 8,
      spiralOpts.waveMultMax ?? 4
    );
    const waveAmpMin = spiralOpts.waveAmpMin ?? 0.5;
    const waveAmpMax = spiralOpts.waveAmpMax ?? 1;
    const waveAmplitude = mult * p.map(
      t,
      -1,
      1,
      size * waveAmpMin,
      size * waveAmpMax
    );
    const angleLimit = -p.PI;

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const lerpSteps = spiralOpts.lerpSteps ?? 500;
    const lerpStep = 1 / lerpSteps;
    const indexScale = motion.indexScale ?? 5;
    const dMin = spiralOpts.diameterMin ?? 30;
    const dMax = spiralOpts.diameterMax ?? 100;
    const opFalloffMax = colorOpts.opacityFalloffMax ?? 200;
    const opFalloffScale = colorOpts.opacityFalloffScale ?? 10;
    const opTimeScale = colorOpts.opacityCurveTimeScale ?? 3;

    for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
      const angle = p.map(
        lerpIndex,
        0,
        1,
        -angleLimit,
        angleLimit
      );
      const lerpPosition = mappers.lerpVector(
        start,
        end,
        lerpIndex
      );
      const tt = p.map(
        p.sin( time * timeSpeed + lerpIndex + index / indexScale ),
        -1,
        1,
        -4,
        4
      );
      const waveIndex = angle + tt;
      const xOffset = p.map(
        p.sin( waveIndex * lerpIndex ),
        -1,
        1,
        -waveAmplitude,
        waveAmplitude
      );
      const yOffset = p.map(
        p.cos( waveIndex - lerpIndex ),
        -1,
        1,
        -waveAmplitude,
        waveAmplitude
      );

      const f = p.map(
        lerpIndex,
        0,
        1,
        1,
        opFalloffScale
      );
      const opacityFactor = p.map(
        lerpIndex,
        0,
        1,
        p.map(
          p.sin( lerpIndex * f + time * opTimeScale ),
          -1,
          1,
          1,
          opFalloffMax
        ),
        1
      );

      p.fill(
        p.map(
          p.sin( angle + hueCadence ),
          1,
          -1,
          360,
          0
        ) / opacityFactor,
        p.map(
          p.cos( angle - hueCadence ),
          1,
          -1,
          255,
          0
        ) / opacityFactor,
        p.map(
          p.sin( angle + hueCadence ),
          1,
          -1,
          0,
          255
        ) / opacityFactor
      );

      const d = p.map(
        p.sin( time * timeSpeed + waveIndex * 2 ),
        -1,
        1,
        dMin,
        dMax
      );

      p.circle(
        lerpPosition.x - xOffset,
        lerpPosition.y - yOffset,
        d
      );
    }

    p.pop();
  }
}

sketch.setup( () => {
  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SpiralClass: Spiral
  } );
} );

sketch.draw( ( time ) => {
  const p = getP5();

  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SpiralClass: Spiral
  } );

  p.noStroke();
  p.clear();
  p.background( ...( options.sketch?.backgroundColor ?? [
    0
  ] ) );

  const timeBoost = p.map(
    p.sin( time ),
    -1,
    1,
    0,
    2
  );

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time + timeBoost,
    index
  ) );
} );
