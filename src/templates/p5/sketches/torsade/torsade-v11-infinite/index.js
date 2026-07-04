import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
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

    const hueCadence = index + time * ( colorOpts.hueSpeed ?? 1 );
    const waveAmplitude = size / ( spiralOpts.waveAmplitudeDivisor ?? 1.5 );

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const lerpSteps = spiralOpts.lerpSteps ?? 350;
    const lerpStep = 1 / lerpSteps;
    const angleModSpeed = motion.angleModSpeed ?? 1;
    const waveTimeScale = motion.waveTimeScale ?? 2;
    const timeMin = motion.timeMin ?? -8;
    const timeMax = motion.timeMax ?? 8;
    const circleSize = spiralOpts.circleSize ?? 120;

    for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
      const angle = p.map(
        lerpIndex,
        0,
        1 / p.map(
          p.sin( time * angleModSpeed ),
          -1,
          1,
          timeMin,
          timeMax
        ),
        p.cos( lerpIndex * p.map(
          p.cos( time * angleModSpeed ),
          -1,
          1,
          -p.PI,
          p.PI
        ) ),
        p.sin( lerpIndex * p.map(
          p.sin( time * angleModSpeed ),
          -1,
          1,
          -p.PI,
          p.PI
        ) )
      );
      const lerpPosition = mappers.lerpVector(
        start,
        end,
        lerpIndex
      );
      const waveIndex = angle + time * waveTimeScale;
      const xOffset = p.map(
        p.sin( waveIndex ),
        -1,
        1,
        -waveAmplitude,
        waveAmplitude
      );
      const yOffset = p.map(
        p.cos( waveIndex ),
        1,
        -1,
        -waveAmplitude,
        waveAmplitude
      );

      p.fill(
        p.map(
          p.sin( waveIndex + waveIndex ),
          -1,
          1,
          0,
          255
        ),
        p.map(
          p.cos( angle - hueCadence ),
          -1,
          1,
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
