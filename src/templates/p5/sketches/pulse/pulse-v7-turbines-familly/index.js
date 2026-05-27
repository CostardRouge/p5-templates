import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
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
      position
    } = this;

    const sizeStart = spiralOpts.sizeStart ?? 60;
    const sizeEnd = spiralOpts.sizeEnd ?? 15;
    const opacityStart = spiralOpts.opacityStart ?? 3;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowsCount = spiralOpts.shadowsCount ?? 1;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.01;
    const linesCount = spiralOpts.linesCount ?? 7;
    const sizeRatio = spiralOpts.sizeRatio ?? 5;
    const strokeWeightFactor = spiralOpts.strokeWeightFactor ?? 0.5;
    const driftDivisor = motion.driftDivisor ?? 3.5;
    const xWaveSpeed = motion.xWaveSpeed ?? 1;
    const xWaveAmpSpeed = motion.xWaveAmpSpeed ?? 2;
    const ySpeed = motion.ySpeed ?? 2;
    const xDriftMult = motion.xDriftMult ?? 1.5;
    const yDriftMult = motion.yDriftMult ?? 3;
    const rotateAmp = motion.rotateAmp ?? 1.5;
    const rotateSpeed = motion.rotateSpeed ?? 1;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 2;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 10;
    const opacityPulseFreq = colorOpts.opacityPulseFreq ?? 5;

    p.push();
    p.translate(
      position.x,
      position.y
    );

    for (
      let shadowIndex = 0;
      shadowIndex <= shadowsCount;
      shadowIndex += shadowIndexStep
    ) {
      const size = p.map(
        shadowIndex,
        0,
        shadowsCount,
        sizeStart,
        sizeEnd
      );

      const opacityFactor = p.map(
        shadowIndex,
        0,
        shadowsCount,
        p.map(
          p.sin( time * opacityPulseSpeed + shadowIndex * opacityPulseFreq ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd
      );

      const l = shadowIndex / driftDivisor;
      const x = p.map(
        p.sin( time * xWaveSpeed + p.sin( time * xWaveAmpSpeed ) - shadowIndex ),
        -1,
        1,
        -l,
        l
      );
      const y = p.map(
        p.cos( time * ySpeed - shadowIndex ),
        -1,
        1,
        -l,
        l
      );

      p.translate(
        x * xDriftMult,
        y * yDriftMult
      );

      const angleStep = p.TAU / linesCount;

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        const vector = converters.polar.vector(
          angle,
          size * sizeRatio
        );

        p.push();

        p.beginShape();
        p.strokeWeight( size * strokeWeightFactor );

        p.rotate( p.map(
          p.sin( -time * rotateSpeed + shadowIndex ),
          -1,
          1,
          -rotateAmp,
          rotateAmp
        ) );

        p.stroke( p.color(
          p.map(
            p.sin( -time + shadowIndex ),
            -1,
            1,
            0,
            360
          ) / opacityFactor,
          p.map(
            p.cos( -time + shadowIndex ),
            -1,
            1,
            360,
            0
          ) / opacityFactor,
          p.map(
            p.sin( -time + shadowIndex ),
            -1,
            1,
            360,
            0
          ) / opacityFactor
        ) );

        p.vertex(
          vector.x,
          vector.y
        );
        p.vertex(
          vector.x,
          -vector.y
        );

        p.endShape();
        p.pop();
      }
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

  p.background( ...( options.sketch?.background?.color ?? [
    0
  ] ) );

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time,
    index
  ) );

  renderTitle();
} );
