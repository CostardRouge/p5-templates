import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
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
    const shadowsCount = spiralOpts.shadowsCount ?? 1;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.01;
    const linesCount = spiralOpts.linesCount ?? 3;
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

    // Rates that multiply the loop-exact clock (see sketch.draw below) are
    // snapped to whole cycles per loop so the last frame matches the first.
    const opacityPulseSpeedTurns = Math.round( opacityPulseSpeed );
    const xWaveSpeedTurns = Math.round( xWaveSpeed );
    const xWaveAmpSpeedTurns = Math.round( xWaveAmpSpeed );
    const ySpeedTurns = Math.round( ySpeed );
    const rotateSpeedTurns = Math.round( rotateSpeed );

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
          p.sin( index - time * opacityPulseSpeedTurns + shadowIndex * opacityPulseFreq ),
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
        p.sin( time * xWaveSpeedTurns + p.sin( time * xWaveAmpSpeedTurns ) - indexCoefficient ),
        -1,
        1,
        -l,
        l
      );
      const y = p.map(
        p.cos( time * ySpeedTurns - indexCoefficient ),
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
        p.strokeWeight( size );

        p.rotate( p.sin( time * rotateSpeedTurns + shadowIndex ) * rotateAmp );

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

sketch.draw( () => {
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

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop, unlike the
  // raw time.seconds() clock previously passed in here (it never wrapped, so
  // the last frame never matched the first). Rates that scale it are snapped
  // to whole cycles per loop inside Spiral.draw.
  const time = animation.angle;

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time,
    index
  ) );

  renderTitle();
} );
