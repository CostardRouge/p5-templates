import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import converters from "@/p5/utils/converters.js";
import colors from "@/p5/utils/colors.js";
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

    const weightStart = spiralOpts.weightStart ?? 400;
    const weightEnd = spiralOpts.weightEnd ?? 20;
    const opacityStart = spiralOpts.opacityStart ?? 10;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowsCount = spiralOpts.shadowsCount ?? 20;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.05;
    const sizeMinFactor = spiralOpts.sizeMinFactor ?? 0.2;
    const sizeMaxFactor = spiralOpts.sizeMaxFactor ?? 1.5;
    const angleSubdivisions = spiralOpts.angleSubdivisions ?? 5;
    const offsetMultMax = motion.offsetMultMax ?? 10;
    const offsetMultSpeed = motion.offsetMultSpeed ?? 0.2;
    const hueSpeed = colorOpts.hueSpeed ?? 1;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 3;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 25;
    const opacityEndDivisor = colorOpts.opacityEndDivisor ?? 2;

    // Loop-exact clock: `time` is animation.angle, which sweeps exactly TAU
    // per loop, so every oscillator driven by it only returns to its start
    // value when its rate is a WHOLE number of cycles per loop — snap each
    // raw slider rate to the nearest whole cycle below.
    const hueCycles = Math.round( hueSpeed );
    const opacityPulseCycles = Math.round( opacityPulseSpeed );
    const offsetMultCycles = Math.round( offsetMultSpeed );

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
          p.sin( shadowIndex + time * opacityPulseCycles ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd / opacityEndDivisor
      );

      const offsetMult = p.map(
        p.sin( time * offsetMultCycles + index ),
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
          angle + shadowOffset,
          p.map(
            p.sin( time + shadowIndex ),
            -1,
            1,
            size * sizeMinFactor,
            size * sizeMaxFactor
          )
        );

        p.beginShape();
        p.strokeWeight( weight );
        p.stroke( colors.rainbow( {
          hueIndex: hueCadence + angle,
          opacityFactor
        } ) );

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
