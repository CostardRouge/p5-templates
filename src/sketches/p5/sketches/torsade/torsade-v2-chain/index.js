import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
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
      position, size, start, end
    } = this;

    const hueCadence = index + time * ( colorOpts.hueSpeed ?? -2 );
    const angleLimit = p.map(
      p.sin( time * ( motion.angleLimitSpeed ?? 1 ) ),
      -1,
      1,
      -p.TAU,
      p.TAU
    );
    const waveAmplitude = size / ( spiralOpts.waveAmplitudeDivisor ?? 1 );

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const lerpSteps = spiralOpts.lerpSteps ?? 200;
    const lerpStep = 1 / lerpSteps;
    const timeSpeed = motion.timeSpeed ?? 3;
    const alternate = motion.alternateDirection ?? true;
    const dir = alternate ? ( index % 2 === 0 ? 1 : -1 ) : 1;
    const circleSize = spiralOpts.circleSize ?? 80;

    for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
      const angle = p.map(
        lerpIndex,
        0,
        1,
        -angleLimit,
        angleLimit
      );
      const lerpPosition = mappers.lerpVector(
        start,
        end,
        lerpIndex
      );
      const waveIndex = -time * timeSpeed * dir + angle;
      const xOffset = p.map(
        p.sin( waveIndex ),
        -1,
        1,
        -waveAmplitude,
        waveAmplitude
      );
      const yOffset = p.map(
        p.cos( waveIndex ),
        -1,
        1,
        -waveAmplitude,
        waveAmplitude
      );

      p.fill(
        p.map(
          p.sin( angle + hueCadence ),
          -1,
          1,
          0,
          360
        ),
        p.map(
          p.cos( angle + hueCadence ),
          1,
          -1,
          0,
          255
        ),
        p.map(
          p.sin( angle + hueCadence ),
          -1,
          1,
          255,
          0
        )
      );

      p.circle(
        lerpPosition.x + xOffset,
        lerpPosition.y + yOffset,
        circleSize
      );
      p.circle(
        lerpPosition.x - xOffset,
        lerpPosition.y - yOffset,
        circleSize
      );
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

  p.noStroke();
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
