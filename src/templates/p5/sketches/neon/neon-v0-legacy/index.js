import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import animation from "@/p5/utils/animation.js";
import {
  SpiralBase, rebuildGrid
} from "../_shared.js";

const sketchState = {
  shapes: [],
  lastLayout: ""
};

class Spiral extends SpiralBase {
  draw(
    time, index, total
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
    const t = time * timeSpeed;
    const hueCadence = index + t * ( colorOpts.hueSpeed ?? 1 );

    const polarValuesX = motion.xPolarValues ?? [
      1,
      2,
      4,
      2,
      3,
      1
    ];
    const polarValuesY = motion.yPolarValues ?? [
      1,
      3,
      3,
      4,
      3,
      1
    ];
    const polarLerp = motion.polarSeqLerp ?? 0.009;

    this.xPolarCoefficient = animation.sequence(
      `v0-x-${ index }`,
      index + t / 2,
      polarValuesX,
      polarLerp
    );
    this.yPolarCoefficient = animation.sequence(
      `v0-y-${ index }`,
      index + t / 3,
      polarValuesY,
      polarLerp
    );

    const waveAmpRange = spiralOpts.waveAmpRange ?? 1.5;
    const waveAmplitude = size * p.map(
      p.sin( t ),
      -1,
      1,
      -waveAmpRange,
      waveAmpRange
    );

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const lerpStepsMin = spiralOpts.lerpStepsMin ?? 75;
    const lerpStepsMax = spiralOpts.lerpStepsMax ?? 200;
    const lerpSteps = p.map(
      index,
      0,
      Math.max(
        1,
        total - 1
      ),
      lerpStepsMin,
      lerpStepsMax
    );
    const lerpStep = 1 / lerpSteps;

    const weight = spiralOpts.weight ?? 75;
    const opacityFactor = spiralOpts.opacityFactor ?? 2;

    for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
      const lerpPosition = mappers.lerpVector(
        start,
        end,
        lerpIndex
      );

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
        p.cos( angle + t * 2 ),
        -1,
        1,
        -p.PI,
        p.PI
      );
      const xOffset = p.map(
        p.sin( angle + t ),
        -1,
        1,
        -p.PI,
        p.PI
      );

      const vector = p.createVector(
        converters.polar.get(
          p.sin.bind( p ),
          waveAmplitude,
          xOffset,
          this.xPolarCoefficient
        ),
        converters.polar.get(
          p.cos.bind( p ),
          waveAmplitude,
          yOffset,
          this.yPolarCoefficient
        )
      );

      p.beginShape();
      p.strokeWeight( weight );

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
        ) / opacityFactor
      );

      p.vertex(
        vector.x,
        vector.y
      );
      p.vertex(
        vector.x,
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

  p.clear();
  p.background( ...( options.sketch?.backgroundColor ?? [
    0
  ] ) );

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time,
    index,
    sketchState.shapes.length
  ) );
} );
