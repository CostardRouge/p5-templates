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
      position, size
    } = this;

    const weightStart = spiralOpts.weightStart ?? 200;
    const weightEnd = spiralOpts.weightEnd ?? 20;
    const opacityStart = spiralOpts.opacityStart ?? 5;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowsCount = spiralOpts.shadowsCount ?? 5;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.01;
    const sizeMinFactor = spiralOpts.sizeMinFactor ?? 0.5;
    const sizeMaxFactor = spiralOpts.sizeMaxFactor ?? 1;
    const angleSubdivisions = spiralOpts.angleSubdivisions ?? 8;
    const xSpeed = motion.xSpeed ?? -3;
    const ySpeed = motion.ySpeed ?? 1;
    const drift = motion.drift ?? 0.9;
    const offsetMultMax = motion.offsetMultMax ?? 5;
    const offsetMultSpeed = motion.offsetMultSpeed ?? 0.5;
    const angleSpinSpeed = motion.angleSpinSpeed ?? -1;
    const hueSpeed = colorOpts.hueSpeed ?? 1;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 3;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 10;

    // Loop-exact clock: `time` is animation.angle, which sweeps exactly TAU
    // per loop, so every oscillator driven by it only returns to its start
    // value when its rate is a WHOLE number of cycles per loop — snap each
    // raw slider rate to the nearest whole cycle below.
    const opacityPulseCycles = Math.round( opacityPulseSpeed );
    const xCycles = Math.round( xSpeed );
    const yCycles = Math.round( ySpeed );
    const offsetMultCycles = Math.round( offsetMultSpeed );
    const angleSpinCycles = Math.round( angleSpinSpeed );
    const hueCycles = Math.round( hueSpeed );

    const hueCadence = index + time * hueCycles;

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
          p.sin( time * opacityPulseCycles + shadowIndex ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd
      );

      const x = p.map(
        p.sin( time * xCycles + shadowIndex ),
        -1,
        1,
        -drift,
        drift
      );
      const y = p.map(
        p.cos( time * yCycles + shadowIndex ),
        -1,
        1,
        -drift,
        drift
      );

      p.translate(
        x,
        y
      );

      const offsetMult = p.map(
        p.sin( time * offsetMultCycles ),
        -1,
        1,
        0,
        offsetMultMax
      );
      const shadowOffset = p.radians( shadowIndex * offsetMult );
      const angleStep = p.TAU / angleSubdivisions;

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        const vector = converters.polar.vector(
          angle + ( index % 2 ? -time : time ) * angleSpinCycles + shadowOffset,
          p.map(
            p.cos( time + shadowIndex ),
            -1,
            1,
            size * sizeMinFactor,
            size * sizeMaxFactor
          )
        );

        p.beginShape();
        p.strokeWeight( weight );
        p.stroke( p.color(
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
            360,
            0
          ) / opacityFactor,
          p.map(
            p.sin( angle + hueCadence ),
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

  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SpiralClass: Spiral
  } );

  p.clear();
  p.background( ...( options.sketch?.background?.color ?? [
    0
  ] ) );

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop (the raw
  // `time.seconds()` the draw loop used to receive never wraps, so nothing
  // driven by it could ever close the seam).
  const t = animation.angle;

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    t,
    index
  ) );

  renderTitle();
} );
