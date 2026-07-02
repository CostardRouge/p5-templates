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

    const weightStart = spiralOpts.weightStart ?? 300;
    const weightEnd = spiralOpts.weightEnd ?? 20;
    const opacityStart = spiralOpts.opacityStart ?? 5;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowsCount = spiralOpts.shadowsCount ?? 10;
    const shadowIndexStep = spiralOpts.shadowIndexStep ?? 0.01;
    const sizeMinFactor = spiralOpts.sizeMinFactor ?? 0.1;
    const sizeMaxFactor = spiralOpts.sizeMaxFactor ?? 1;
    const linesCount = spiralOpts.linesCount ?? 7;
    const xSpeed = motion.xSpeed ?? -2;
    const ySpeed = motion.ySpeed ?? 2;
    const drift = motion.drift ?? 0.4;
    const offsetMultMax = motion.offsetMultMax ?? 10;
    const offsetMultSpeed = motion.offsetMultSpeed ?? 1;
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
        y
      );

      const offsetMult = p.map(
        p.sin( time * offsetMultSpeed ),
        -1,
        1,
        0,
        offsetMultMax
      );
      const shadowOffset = p.radians( shadowIndex * offsetMult );
      const angleStep = p.TAU / p.map(
        p.sin( time + shadowIndex ),
        -1,
        1,
        1,
        linesCount
      );

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        const vector = converters.polar.vector(
          angle + ( index % 2 ? -time : time ) * 0 + shadowOffset,
          p.map(
            p.sin( time + shadowIndex ),
            -1,
            1,
            size * sizeMinFactor,
            size * sizeMaxFactor
          )
        );

        const opacityFactor = p.map(
          shadowIndex,
          0,
          shadowsCount,
          p.map(
            p.sin( time * opacityPulseSpeed + shadowIndex ),
            -1,
            1,
            opacityStart,
            opacityStart * opacityPulseMaxFactor
          ),
          opacityEnd
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

  renderTitle();
} );
