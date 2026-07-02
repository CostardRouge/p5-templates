import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  SpiralBase, rebuildGrid, snapLoopRate
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

    // Loop-exact rates: raw time is the sketch's non-wrapping clock, so every
    // rate multiplying it is snapped to whole cycles per loop (see
    // ../_shared.js#snapLoopRate).
    const hueCadence = index + time * snapLoopRate( colorOpts.hueSpeed ?? 1 );
    const waveAmplitude = size / ( spiralOpts.waveAmplitudeDivisor ?? 2.5 );

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const lerpSteps = spiralOpts.lerpSteps ?? 300;
    const lerpStep = 1 / lerpSteps;
    const cadenceSpeed = snapLoopRate( motion.cadenceSpeed ?? 1 );
    const cadenceIndexScale = motion.cadenceIndexScale ?? 1;
    const cadenceMin = spiralOpts.cadenceMin ?? -4;
    const cadenceMax = spiralOpts.cadenceMax ?? 4;
    const circleSize = spiralOpts.circleSize ?? 100;
    const hueIndexScale = colorOpts.hueIndexScale ?? 1;

    for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
      const angle = p.map(
        lerpIndex,
        0,
        1,
        -p.PI,
        p.PI
      );
      const lerpPosition = mappers.lerpVector(
        start,
        end,
        lerpIndex
      );
      const cadence = p.map(
        p.sin( -time * cadenceSpeed + lerpIndex + index * cadenceIndexScale ),
        -1,
        1,
        cadenceMin,
        cadenceMax
      );
      const waveIndex = angle * cadence;
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
          p.sin( angle * hueIndexScale + hueCadence ),
          -1,
          1,
          0,
          360
        ),
        p.map(
          p.cos( angle * hueIndexScale + hueCadence ),
          -1,
          1,
          0,
          255
        ),
        p.map(
          p.sin( angle * hueIndexScale + hueCadence ),
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

  renderTitle();
} );
