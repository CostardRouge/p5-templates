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
      position, size
    } = this;

    const weightStart = spiralOpts.weightStart ?? 200;
    const weightEnd = spiralOpts.weightEnd ?? 100;
    const opacityStart = spiralOpts.opacityStart ?? 5;
    const opacityEnd = spiralOpts.opacityEnd ?? 1.5;
    const shadowsCount = spiralOpts.shadowsCount ?? 5;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.01;
    const sizeMinFactor = spiralOpts.sizeMinFactor ?? 0.5;
    const sizeMaxFactor = spiralOpts.sizeMaxFactor ?? 1;
    const angleSubdivisions = spiralOpts.angleSubdivisions ?? 3;
    const strokeWeightDivisor = spiralOpts.strokeWeightDivisor ?? 2;
    const driftDivisor = motion.driftDivisor ?? 2;
    const xSpeed = motion.xSpeed ?? 1;
    const ySpeed = motion.ySpeed ?? -2;
    const xDriftMult = motion.xDriftMult ?? 1 / 1.7;
    const yDriftMult = motion.yDriftMult ?? 1;
    const rotateAmp = motion.rotateAmp ?? 1;
    const rotateSpeed = motion.rotateSpeed ?? 2;
    const hueSpeed = colorOpts.hueSpeed ?? 1;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 7;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 5;
    const opacityPulseFreq = colorOpts.opacityPulseFreq ?? 2;

    // t sweeps exactly TAU per loop, and every sin/cos below takes it as a raw
    // radian angle, so each rate must complete a WHOLE number of turns per
    // loop to land back on its start value — snapped to whole turns per loop.
    const hueTurns = Math.round( hueSpeed );
    const opacityPulseTurns = Math.round( opacityPulseSpeed );
    const xTurns = Math.round( xSpeed );
    const yTurns = Math.round( ySpeed );
    const rotateTurns = Math.round( rotateSpeed );

    const hueCadence = index + t * hueTurns;

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
        p.sin( t * xTurns + shadowIndex ),
        -1,
        1,
        -l,
        l
      ) * xDriftMult;
      const y = p.map(
        p.cos( t * yTurns + shadowIndex ),
        -1,
        1,
        -l,
        l
      ) * yDriftMult;

      p.translate(
        x,
        y
      );

      const angleStep = p.TAU / angleSubdivisions;

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        const vector = converters.polar.vector(
          angle,
          p.map(
            p.cos( t + shadowIndex ),
            -1,
            1,
            size * sizeMinFactor,
            size * sizeMaxFactor
          )
        );

        p.beginShape();
        p.strokeWeight( weight / strokeWeightDivisor );

        p.rotate( p.map(
          p.cos( shadowIndex + t * rotateTurns ),
          -1,
          1,
          -rotateAmp,
          rotateAmp
        ) );

        p.stroke( p.color(
          p.map(
            p.sin( hueCadence + shadowIndex + l ),
            -1,
            1,
            0,
            360
          ) / opacityFactor,
          p.map(
            p.cos( hueCadence - shadowIndex + l ),
            -1,
            1,
            360,
            0
          ) / opacityFactor,
          p.map(
            p.sin( hueCadence + shadowIndex + l ),
            -1,
            1,
            360,
            0
          ) / opacityFactor
        ) );

        p.vertex(
          vector.x,
          -vector.y
        );
        p.vertex(
          vector.x,
          vector.y
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
  // rates snapped above land back on their start value at the seam.
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
