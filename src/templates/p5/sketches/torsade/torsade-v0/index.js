import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import converters from "@/p5/utils/converters.js";
import {
  SpiralBase, rebuildGrid
} from "../_shared.js";

const sketchState = {
  shapes: [],
  lastLayout: ""
};

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

    const hueCadence = index + time * ( colorOpts.hueSpeed ?? 3 );
    const waveAmplitude = size;

    p.push();
    p.translate(
      position.x,
      position.y
    );

    this.xPolarCoefficient = animation.sequence(
      `v0-x-${ index }`,
      index + time / 2,
      motion.xPolarValues ?? [
        1,
        2,
        4,
        2,
        3,
        1
      ],
      motion.polarSeqLerp ?? 0.009
    );
    this.yPolarCoefficient = animation.sequence(
      `v0-y-${ index }`,
      index + time / 3,
      motion.yPolarValues ?? [
        1,
        3,
        3,
        4,
        3,
        1
      ],
      motion.polarSeqLerp ?? 0.009
    );

    const lerpSteps = spiralOpts.lerpSteps ?? 600;
    const lerpStep = 1 / lerpSteps;
    const xWaveSpeed = motion.xWaveSpeed ?? 2;
    const yWaveSpeed = motion.yWaveSpeed ?? 1;
    const weightSpeed = spiralOpts.weightSpeed ?? 1;
    const weightWaveScale = spiralOpts.weightWaveScale ?? 10;
    const strokeWeightMin = spiralOpts.strokeWeightMin ?? 25;
    const strokeWeightMax = spiralOpts.strokeWeightMax ?? 90;
    const opacityCurveSpeed = colorOpts.opacityCurveSpeed ?? 50;
    const opacityMin = colorOpts.opacityMin ?? 1;
    const opacityMax = colorOpts.opacityMax ?? 7;
    const alphaScale = colorOpts.alphaScale ?? 15;

    for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
      const lerpPosition = mappers.lerpVector(
        start,
        end,
        lerpIndex
      );
      const {
        xPolarCoefficient, yPolarCoefficient
      } = this;

      p.push();
      p.translate(
        lerpPosition.x,
        lerpPosition.y
      );

      const angle = p.map(
        lerpIndex,
        0,
        1,
        -p.PI,
        p.PI
      );

      const yOffset = p.map(
        p.cos( angle + index + time * xWaveSpeed ),
        -1,
        1,
        -waveAmplitude,
        waveAmplitude
      );
      const xOffset = p.map(
        p.sin( angle + index + time * yWaveSpeed ),
        -1,
        1,
        waveAmplitude,
        -waveAmplitude
      );

      const vector = p.createVector(
        converters.polar.get(
          p.sin.bind( p ),
          xOffset,
          angle + yPolarCoefficient,
          xPolarCoefficient
        ),
        converters.polar.get(
          p.cos.bind( p ),
          yOffset,
          angle + xPolarCoefficient,
          yPolarCoefficient
        )
      );
      const nextVector = p.createVector(
        converters.polar.get(
          p.sin.bind( p ),
          xOffset,
          angle,
          xPolarCoefficient
        ),
        converters.polar.get(
          p.cos.bind( p ),
          yOffset,
          angle,
          yPolarCoefficient
        )
      );

      const opacityFactor = p.map(
        lerpIndex,
        0,
        5,
        p.map(
          p.sin( -time * ( index % 2 === 0 ? -1 : 1 ) * 2 + lerpIndex * opacityCurveSpeed ),
          -1,
          1,
          opacityMin,
          opacityMax
        ),
        1
      );

      const w = p.map(
        p.sin( index + time * weightSpeed + angle / 30 + lerpIndex * weightWaveScale ),
        -1,
        1,
        strokeWeightMin,
        strokeWeightMax
      );

      p.beginShape();
      p.strokeWeight( w );

      p.stroke(
        p.map(
          p.sin( angle + hueCadence ),
          -1,
          1,
          0,
          360
        ) / opacityFactor,
        p.map(
          p.cos( angle + hueCadence ),
          -1,
          1,
          0,
          255
        ) / opacityFactor,
        p.map(
          p.sin( angle + hueCadence ),
          -1,
          1,
          255,
          0
        ) / opacityFactor,
        p.map(
          xPolarCoefficient + yPolarCoefficient,
          0,
          alphaScale,
          0,
          255
        )
      );

      p.vertex(
        vector.x,
        nextVector.y
      );
      p.vertex(
        nextVector.x,
        vector.y
      );

      p.endShape();
      p.pop();
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

  const bg = options.sketch?.background?.color ?? [
    0,
    0,
    0,
    8
  ];

  p.background( ...bg );

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time,
    index
  ) );
} );
