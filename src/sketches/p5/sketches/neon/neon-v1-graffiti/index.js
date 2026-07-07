import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
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
      position, size, start, end
    } = this;

    const timeSpeed = motion.timeSpeed ?? 1;
    const t = time * timeSpeed;
    const hueCadence = index + t * ( colorOpts.hueSpeed ?? 1 );

    const shadowsCount = spiralOpts.shadowsCount ?? 3;
    const weightMin = spiralOpts.weightMin ?? 100;
    const weightMax = spiralOpts.weightMax ?? 250;
    const opacityMin = spiralOpts.opacityMin ?? 1;
    const opacityMax = spiralOpts.opacityMax ?? 10;
    const lerpSteps = spiralOpts.lerpSteps ?? 200;
    const angleNarrow = spiralOpts.angleNarrow ?? 0.6;
    const waveAmplitude = size;

    p.push();
    p.translate(
      position.x,
      position.y
    );

    for ( let shadowIndex = 0; shadowIndex <= shadowsCount; shadowIndex++ ) {
      const weight = p.map(
        shadowIndex,
        0,
        Math.max(
          1,
          shadowsCount
        ),
        weightMax,
        weightMin
      );
      const opacityFactor = p.map(
        shadowIndex,
        0,
        Math.max(
          1,
          shadowsCount
        ),
        opacityMax,
        opacityMin
      );
      const lerpStep = 1 / lerpSteps;

      for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
        const lerpPosition = mappers.lerpVector(
          start,
          end,
          lerpIndex
        );

        p.push();
        p.translate(
          lerpPosition.x,
          lerpPosition.y
        );

        const angle = p.map(
          lerpIndex,
          0,
          angleNarrow,
          -p.PI,
          p.PI
        );
        const yOffset = p.map(
          p.cos( angle + t * 2 ),
          -1,
          1,
          -p.PI,
          p.PI
        );
        const xOffset = p.map(
          p.sin( angle + t ),
          -1,
          1,
          -p.PI,
          p.PI
        );

        const vector = p.createVector(
          converters.polar.get(
            p.sin.bind( p ),
            waveAmplitude,
            xOffset
          ),
          converters.polar.get(
            p.cos.bind( p ),
            waveAmplitude,
            yOffset
          )
        );

        p.beginShape();
        p.strokeWeight( weight );

        p.stroke(
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
            0,
            255
          ) / opacityFactor,
          p.map(
            p.sin( angle + hueCadence ),
            -1,
            1,
            255,
            0
          ) / opacityFactor
        );

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
  p.background( ...( options.sketch?.backgroundColor ?? [
    0
  ] ) );

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time,
    index
  ) );
} );
