import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import animation from "@/p5/utils/animation.js";
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
    t, index
  ) {
    const p = getP5();
    const o = options.sketch ?? {};
    const spiralOpts = o.spiral ?? {};
    const motion = o.motion ?? {};
    const colorOpts = o.colors ?? {};

    const {
      position
    } = this;

    const sizeStart = spiralOpts.sizeStart ?? 20;
    const sizeEnd = spiralOpts.sizeEnd ?? 20;
    const opacityStart = spiralOpts.opacityStart ?? 3;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowsCountMin = spiralOpts.shadowsCountMin ?? 3;
    const shadowsCountMax = spiralOpts.shadowsCountMax ?? 7;
    const shadowsCountSpeed = spiralOpts.shadowsCountSpeed ?? 0.5;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.01;
    const linesCount = spiralOpts.linesCount ?? 5;
    const sizeRatio = spiralOpts.sizeRatio ?? 5;
    const driftDivisor = motion.driftDivisor ?? 3.5;
    const xWaveSpeed = motion.xWaveSpeed ?? 1;
    const xWaveAmpSpeed = motion.xWaveAmpSpeed ?? 2;
    const ySpeed = motion.ySpeed ?? 2;
    const xDriftMult = motion.xDriftMult ?? 1.5;
    const yDriftMult = motion.yDriftMult ?? 3;
    const rotateBaseSpeed = motion.rotateBaseSpeed ?? 2;
    const rotateShadowSpeed = motion.rotateShadowSpeed ?? 2;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 2;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 10;
    const opacityPulseFreq = colorOpts.opacityPulseFreq ?? 5;

    // t sweeps exactly TAU per loop, so every rate multiplying it must
    // complete a WHOLE number of turns per loop to land back on its start
    // value — snapped to whole turns per loop.
    const shadowsCountTurns = Math.round( shadowsCountSpeed );
    const opacityPulseTurns = Math.round( opacityPulseSpeed );
    const xWaveTurns = Math.round( xWaveSpeed );
    const xWaveAmpTurns = Math.round( xWaveAmpSpeed );
    const yTurns = Math.round( ySpeed );
    const rotateBaseTurns = Math.round( rotateBaseSpeed );

    const shadowsCount = p.map(
      p.cos( t * shadowsCountTurns ),
      -1,
      1,
      shadowsCountMin,
      shadowsCountMax
    );

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
          p.sin( t * opacityPulseTurns + shadowIndex * opacityPulseFreq ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd
      );

      const l = shadowIndex / driftDivisor;
      const x = p.map(
        p.sin( t * xWaveTurns + p.sin( t * xWaveAmpTurns ) - shadowIndex ),
        -1,
        1,
        -l,
        l
      );
      const y = p.map(
        p.cos( t * yTurns - shadowIndex ),
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
        p.push();
        const vector = converters.polar.vector(
          angle,
          size * sizeRatio
        );

        p.beginShape();
        p.strokeWeight( size );

        p.rotate( t * rotateBaseTurns + shadowIndex * rotateShadowSpeed );

        p.stroke( p.color(
          p.map(
            p.sin( -t + shadowIndex ),
            -1,
            1,
            0,
            360
          ) / opacityFactor,
          p.map(
            p.cos( -t + shadowIndex ),
            -1,
            1,
            360,
            0
          ) / opacityFactor,
          p.map(
            p.sin( -t + shadowIndex ),
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

sketch.draw( () => {
  const p = getP5();

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop (instead of
  // the raw, non-wrapping seconds clock previously passed in here), so the
  // rates snapped above land back on their start value.
  const t = animation.angle;

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
    t,
    index
  ) );

  renderTitle();
} );
