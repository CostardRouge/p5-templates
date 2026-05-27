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

    const weightStart = spiralOpts.weightStart ?? 200;
    const weightEnd = spiralOpts.weightEnd ?? 20;
    const opacityStart = spiralOpts.opacityStart ?? 5;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowsCount = spiralOpts.shadowsCount ?? 5;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.01;
    const linesCount = spiralOpts.linesCount ?? 3;
    const sizeRatio = spiralOpts.sizeRatio ?? 3;
    const driftDivisor = motion.driftDivisor ?? 2;
    const xSpeed = motion.xSpeed ?? 2;
    const ySpeed = motion.ySpeed ?? 1;
    const rotateAmp = motion.rotateAmp ?? 0.5;
    const rotateSpeed = motion.rotateSpeed ?? 1;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 5;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 10;
    const opacityPulseFreq = colorOpts.opacityPulseFreq ?? 2;
    const hueShadowMultiplier = colorOpts.hueShadowMultiplier ?? 1;

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
      const weight = p.map(
        shadowIndex,
        0,
        shadowsCount,
        weightStart,
        weightEnd
      );

      const opacityFactor = p.map(
        shadowIndex,
        0,
        shadowsCount,
        p.map(
          p.sin( -time * opacityPulseSpeed + shadowIndex * opacityPulseFreq ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd
      );

      const l = shadowIndex / driftDivisor;
      const x = p.map(
        p.sin( time * xSpeed + shadowIndex ),
        -1,
        1,
        -l,
        l
      );
      const y = p.map(
        p.cos( time * ySpeed + shadowIndex ),
        -1,
        1,
        -l,
        l
      );

      p.translate(
        x,
        y
      );

      const angleStep = p.TAU / linesCount;

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        const vector = converters.polar.vector(
          angle,
          weight * sizeRatio
        );

        p.beginShape();
        p.strokeWeight( weight );

        p.rotate( p.map(
          p.sin( time * rotateSpeed + shadowIndex ),
          -1,
          1,
          -rotateAmp,
          rotateAmp
        ) );

        const hueIdx = shadowIndex * hueShadowMultiplier + l;

        p.stroke( p.color(
          p.map(
            p.sin( hueIdx ),
            -1,
            1,
            0,
            360
          ) / opacityFactor,
          p.map(
            p.cos( hueIdx ),
            -1,
            1,
            360,
            0
          ) / opacityFactor,
          p.map(
            p.sin( hueIdx ),
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
