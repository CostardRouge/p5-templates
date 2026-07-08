import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import colors from "@/p5/utils/colors.js";
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
    const opacityEnd = spiralOpts.opacityEnd ?? 0.5;
    const shadowsCount = spiralOpts.shadowsCount ?? 20;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.07;
    const sizeMinFactor = spiralOpts.sizeMinFactor ?? 0.2;
    const sizeMaxFactor = spiralOpts.sizeMaxFactor ?? 1.2;
    const angleSubdivisions = spiralOpts.angleSubdivisions ?? 4;
    const shadowOffsetAmp = motion.shadowOffsetAmp ?? 50;
    const angleDriftSpeed = motion.angleDriftSpeed ?? 1;
    const hueSpeed = colorOpts.hueSpeed ?? 1;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 3;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 150;
    const opacityDivisor = colorOpts.opacityDivisor ?? 2;

    const hueCadence = index + time * hueSpeed;

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
          p.sin( shadowIndex + time * opacityPulseSpeed ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd
      );

      const t = p.map(
        p.sin( time ),
        -1,
        1,
        -shadowOffsetAmp,
        shadowOffsetAmp
      );
      const i = p.map(
        p.sin( time + shadowIndex ),
        -1,
        1,
        p.map(
          p.cos( time ),
          -1,
          1,
          -t,
          t
        ),
        p.map(
          p.sin( time ),
          -1,
          1,
          t,
          -t
        )
      );
      const shadowOffset = p.radians( i );
      const angleStep = p.TAU / angleSubdivisions;

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        const vector = converters.polar.vector(
          angle + ( index % 2 ? -time : time ) * angleDriftSpeed + shadowOffset,
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
          opacityFactor: opacityFactor / opacityDivisor
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
} );
