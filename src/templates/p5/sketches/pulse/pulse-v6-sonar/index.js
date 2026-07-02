import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import colors from "@/p5/utils/colors.js";
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
    const colorOpts = o.colors ?? {};

    const {
      position, size
    } = this;

    const weightStart = spiralOpts.weightStart ?? 400;
    const weightEnd = spiralOpts.weightEnd ?? 20;
    const opacityStart = spiralOpts.opacityStart ?? 10;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowsCount = spiralOpts.shadowsCount ?? 10;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.03;
    const angleSubdivisions = spiralOpts.angleSubdivisions ?? 5;
    const ringRippleMin = spiralOpts.ringRippleMin ?? 1;
    const ringRippleMax = spiralOpts.ringRippleMax ?? 5;
    const hueSpeed = colorOpts.hueSpeed ?? 1;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 5;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 10;

    // colors.rainbow() takes its hueIndex as a raw radian angle, and t sweeps
    // exactly TAU per loop, so the hue/opacity scroll rates must complete a
    // WHOLE number of turns per loop to land back on their start hue/opacity —
    // snapped to whole turns per loop.
    const hueTurns = Math.round( hueSpeed );
    const opacityPulseTurns = Math.round( opacityPulseSpeed );

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

      const r = p.map(
        shadowIndex,
        0,
        shadowsCount,
        ringRippleMin,
        ringRippleMax
      );
      const opacityFactor = p.map(
        shadowIndex,
        0,
        shadowsCount,
        p.map(
          p.sin( shadowIndex * r + t * opacityPulseTurns ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd
      );

      const angleStep = p.TAU / angleSubdivisions;

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        const vector = converters.polar.vector(
          angle,
          size
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

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop (instead of
  // the raw, non-wrapping seconds clock previously passed in here), so the
  // hue/opacity scroll rates snapped above land back on their start value.
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
