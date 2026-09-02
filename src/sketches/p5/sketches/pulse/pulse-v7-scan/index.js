import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import {
  SpiralBase, rebuildGrid
} from "../_shared.js";

const sketchState = sketch.state( () => ( {
  shapes: [],
  lastLayout: ""
} ) );

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
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.02;
    const sizeMinFactor = spiralOpts.sizeMinFactor ?? 0.5;
    const sizeMaxFactor = spiralOpts.sizeMaxFactor ?? 1;
    const angleSubdivisions = spiralOpts.angleSubdivisions ?? 7;
    const xSpeed = motion.xSpeed ?? 1;
    const ySpeed = motion.ySpeed ?? 3;
    const drift = motion.drift ?? 0.6;
    const yDriftMult = motion.yDriftMult ?? 3;
    const offsetMultMax = motion.offsetMultMax ?? 5;
    const offsetMultSpeed = motion.offsetMultSpeed ?? 0.5;
    const angleDriftSpeed = motion.angleDriftSpeed ?? 0.2;
    const hueSpeed = colorOpts.hueSpeed ?? 1;
    const opacityPulseSpeed = colorOpts.opacityPulseSpeed ?? 3;
    const opacityPulseMaxFactor = colorOpts.opacityPulseMaxFactor ?? 10;

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
          p.sin( -time * opacityPulseSpeed + shadowIndex ),
          -1,
          1,
          opacityStart,
          opacityStart * opacityPulseMaxFactor
        ),
        opacityEnd
      );

      const x = p.map(
        p.sin( time * xSpeed + shadowIndex ),
        -1,
        1,
        -drift,
        drift
      );
      const y = p.map(
        p.cos( time * ySpeed + shadowIndex ),
        -1,
        1,
        -drift,
        drift
      );

      p.translate(
        x,
        y * yDriftMult
      );

      const offsetMult = p.map(
        p.sin( time * offsetMultSpeed ),
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
          angle + ( index % 2 ? -time : time ) * -angleDriftSpeed + shadowOffset,
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
            p.sin( shadowIndex + hueCadence ),
            -1,
            1,
            0,
            360
          ) / opacityFactor,
          p.map(
            p.cos( shadowIndex - hueCadence ),
            -1,
            1,
            360,
            0
          ) / opacityFactor,
          p.map(
            p.sin( shadowIndex + hueCadence ),
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
