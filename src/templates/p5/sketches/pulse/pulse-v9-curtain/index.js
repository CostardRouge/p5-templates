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

class GroundLine extends SpiralBase {
  draw(
    time, index
  ) {
    const p = getP5();
    const o = options.sketch ?? {};
    const lineOpts = o.line ?? {};
    const motion = o.motion ?? {};
    const colorOpts = o.colors ?? {};

    const {
      position, size
    } = this;

    const weightStart = lineOpts.weightStart ?? 150;
    const weightEnd = lineOpts.weightEnd ?? 20;
    const shadowsCount = lineOpts.shadowsCount ?? 50;
    const shadowIndexStep = lineOpts.shadowIndexStep ?? 0.1;
    const widthMin = lineOpts.widthMin ?? -1 / 3;
    const widthMax = lineOpts.widthMax ?? 5;
    const sizeDivisorNear = lineOpts.sizeDivisorNear ?? 10;
    const sizeDivisorFar = lineOpts.sizeDivisorFar ?? 1;
    const heightFactor = lineOpts.heightFactor ?? 2;
    const yAnchorOffset = lineOpts.yAnchorOffset ?? -15;
    const driftIndexDivisor = motion.driftIndexDivisor ?? 10;
    const driftShadowDivisor = motion.driftShadowDivisor ?? 5;
    const driftIndexPhase = motion.driftIndexPhase ?? 4;
    const opacityPulseMin = colorOpts.opacityPulseMin ?? 1;
    const opacityPulseMax = colorOpts.opacityPulseMax ?? 15;
    const opacityFalloffMin = colorOpts.opacityFalloffMin ?? 1;
    const opacityFalloffMax = colorOpts.opacityFalloffMax ?? 5;
    const weightPulseShadowDivisor = lineOpts.weightPulseShadowDivisor ?? 3;

    // `time` is the loop-exact clock (animation.angle), which sweeps exactly
    // TAU per loop — every rate multiplying it below is snapped to a whole
    // number of cycles per loop so sin()/cos() land back on their start value
    // at the seam.
    const driftSpeed = Math.round( motion.driftSpeed ?? 1.5 );
    const opacityPulseSpeed = Math.round( colorOpts.opacityPulseSpeed ?? 3 );
    const hueSpeed = Math.round( colorOpts.hueSpeed ?? 1 );
    const weightPulseSpeed = Math.round( lineOpts.weightPulseSpeed ?? 1 );

    const hueCadence = index + time * hueSpeed;

    p.push();
    p.translate(
      position.x,
      p.height / 2 - position.y + yAnchorOffset
    );

    for (
      let shadowIndex = 0;
      shadowIndex <= shadowsCount;
      shadowIndex += shadowIndexStep
    ) {
      const w = p.map(
        shadowIndex,
        0,
        shadowsCount,
        widthMin,
        widthMax
      );
      const h = ( ( size * 10 ) / shadowsCount ) * shadowIndexStep;

      p.translate(
        p.map(
          p.sin( time * driftSpeed +
              index / driftIndexDivisor +
              shadowIndex / driftShadowDivisor +
              index / driftIndexPhase ),
          -1,
          1,
          -w,
          w
        ),
        h * heightFactor
      );

      p.push();
      const vector = converters.polar.vector(
        0,
        size / p.map(
          shadowIndex,
          0,
          shadowsCount,
          sizeDivisorNear,
          sizeDivisorFar
        )
      );

      const f = p.map(
        shadowIndex,
        0,
        shadowsCount,
        opacityFalloffMin,
        opacityFalloffMax
      );
      const opacityFactor = p.map(
        p.sin( shadowIndex / f - time * opacityPulseSpeed + index / 2 ),
        -1,
        1,
        opacityPulseMin,
        opacityPulseMax
      );

      p.beginShape();
      p.strokeWeight( p.map(
        p.sin( time * weightPulseSpeed + shadowIndex / weightPulseShadowDivisor ),
        -1,
        1,
        weightStart,
        weightEnd
      ) );
      p.stroke( p.color(
        p.map(
          p.sin( hueCadence ),
          -1,
          1,
          0,
          360
        ) / opacityFactor,
        p.map(
          p.cos( hueCadence ),
          -1,
          1,
          0,
          360
        ) / opacityFactor,
        p.map(
          p.sin( hueCadence ),
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

    p.pop();
  }
}

sketch.setup( () => {
  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SpiralClass: GroundLine
  } );
} );

sketch.draw( () => {
  const p = getP5();

  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SpiralClass: GroundLine
  } );

  p.clear();
  p.background( ...( options.sketch?.background?.color ?? [
    0
  ] ) );

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop, unlike the
  // raw, non-wrapping time.seconds() this sketch used to pass down — the
  // whole-cycle rates snapped in GroundLine.draw only close the loop when
  // driven by this clock.
  const t = animation.angle;

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    t,
    index
  ) );

  renderTitle();
} );
