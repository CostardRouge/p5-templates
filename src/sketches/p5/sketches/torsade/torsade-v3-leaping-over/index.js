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

    const hueCadence = index;
    const timeSpeed = motion.timeSpeed ?? 1;
    const t = p.sin( time * timeSpeed );
    const mult = p.map(
      t,
      -1,
      1,
      spiralOpts.waveMultMin ?? 3,
      spiralOpts.waveMultMax ?? 8
    );
    const waveAmpDivisor = spiralOpts.waveAmpDivisor ?? 8;
    const waveAmplitude = mult * p.map(
      t,
      -1,
      1,
      size / waveAmpDivisor,
      size
    );
    const angleLimit = -p.PI;
    const angleScale = spiralOpts.angleScale ?? 5;

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const lerpSteps = spiralOpts.lerpSteps ?? 190;
    const lerpStep = 1 / lerpSteps;
    const indexScale = motion.indexScale ?? 10;
    const cadenceMin = motion.cadenceMin ?? -4;
    const cadenceMax = motion.cadenceMax ?? 4;
    const circleSize = spiralOpts.circleSize ?? 100;
    const drawDouble = spiralOpts.drawDouble ?? false;
    const cadenceContrib = colorOpts.cadenceContribution ?? 1;

    for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
      const angle = p.map(
        lerpIndex,
        0,
        angleScale,
        -angleLimit,
        angleLimit
      );
      const lerpPosition = mappers.lerpVector(
        start,
        end,
        lerpIndex
      );
      const tt = p.map(
        p.sin( time * timeSpeed + lerpIndex + index / indexScale ),
        -1,
        1,
        cadenceMin,
        cadenceMax
      );
      const waveIndex = angle + tt;
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

      const colorTime = tt * cadenceContrib;

      p.fill(
        p.map(
          p.sin( angle + hueCadence + colorTime ),
          -1,
          1,
          0,
          360
        ),
        p.map(
          p.cos( angle + hueCadence + colorTime ),
          -1,
          1,
          0,
          255
        ),
        p.map(
          p.sin( angle + hueCadence + colorTime ),
          -1,
          1,
          255,
          0
        )
      );

      p.circle(
        lerpPosition.x - xOffset,
        lerpPosition.y - yOffset,
        circleSize
      );
      if ( drawDouble ) {
        p.circle(
          lerpPosition.x + xOffset,
          lerpPosition.y + yOffset,
          circleSize
        );
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
