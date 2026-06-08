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

    const sizeStart = spiralOpts.sizeStart ?? 50;
    const sizeEnd = spiralOpts.sizeEnd ?? 15;
    const opacityStart = spiralOpts.opacityStart ?? 3;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowsCountMin = spiralOpts.shadowsCountMin ?? 1;
    const shadowsCountMax = spiralOpts.shadowsCountMax ?? 5;
    const shadowsCountSpeedA = spiralOpts.shadowsCountSpeedA ?? 3;
    const shadowsCountSpeedB = spiralOpts.shadowsCountSpeedB ?? 0.333;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.01;
    const linesCountMin = spiralOpts.linesCountMin ?? 1;
    const linesCountMax = spiralOpts.linesCountMax ?? 7;
    const sizeRatio = spiralOpts.sizeRatio ?? 6;
    const driftDivisor = motion.driftDivisor ?? 3;
    const xWaveSpeed = motion.xWaveSpeed ?? 1;
    const xWaveAmpSpeed = motion.xWaveAmpSpeed ?? 2;
    const ySpeed = motion.ySpeed ?? 2;
    const xDriftMult = motion.xDriftMult ?? 1.5;
    const yDriftMult = motion.yDriftMult ?? 3;
    const rotateAmp = motion.rotateAmp ?? 1;
    const rotateSpeed = motion.rotateSpeed ?? 1;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 5;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 5;
    const opacityPulseFreq = colorOpts.opacityPulseFreq ?? 5;
    const hueShadowMixA = colorOpts.hueShadowMixA ?? 2;
    const hueShadowMixB = colorOpts.hueShadowMixB ?? 2;
    const hueShadowMixC = colorOpts.hueShadowMixC ?? 1;

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const shadowsCount = p.map(
      p.cos( index + time * shadowsCountSpeedA ) + p.sin( -time * shadowsCountSpeedB + index ),
      -1,
      1,
      shadowsCountMin,
      shadowsCountMax,
      true
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
          p.sin( index - time * opacityPulseSpeed + shadowIndex * opacityPulseFreq ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd
      );

      const l = shadowIndex / driftDivisor;
      const indexCoefficient = shadowIndex + index;
      const x = p.map(
        p.sin( time * xWaveSpeed + p.sin( time * xWaveAmpSpeed ) - indexCoefficient ),
        -1,
        1,
        -l,
        l
      );
      const y = p.map(
        p.cos( time * ySpeed - indexCoefficient ),
        -1,
        1,
        -l,
        l
      );

      p.translate(
        x * xDriftMult,
        y * yDriftMult
      );

      const angleStep = p.TAU / p.map(
        p.sin( time + index ) + p.cos( -time + index ),
        -1,
        1,
        linesCountMin,
        linesCountMax,
        true
      );

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        const vector = converters.polar.vector(
          angle,
          size * sizeRatio
        );

        p.push();

        p.beginShape();
        p.strokeWeight( size );

        p.rotate( p.sin( time * rotateSpeed + shadowIndex ) * rotateAmp );

        p.stroke( p.color(
          p.map(
            p.sin( -time + shadowIndex + index + shadowIndex * hueShadowMixA ),
            -1,
            1,
            0,
            360
          ) / opacityFactor,
          p.map(
            p.cos( -time - shadowIndex + index - shadowIndex * hueShadowMixB ),
            -1,
            1,
            360,
            0
          ) / opacityFactor,
          p.map(
            p.sin( -time + shadowIndex + index + shadowIndex * hueShadowMixC ),
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
          -vector.x,
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

  p.clear();
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
