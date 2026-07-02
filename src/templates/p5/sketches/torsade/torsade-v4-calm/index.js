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
    const hueCadence = index + time * snapLoopRate( colorOpts.hueSpeed ?? -1 );

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const lerpSteps = spiralOpts.lerpSteps ?? 500;
    const lerpStep = 1 / lerpSteps;
    const rawTimeSpeed = motion.timeSpeed ?? 1;
    const indexScale = motion.indexScale ?? 2;
    const angleScale = motion.angleScale ?? 1;
    const ampScale = spiralOpts.angleAmpScale ?? 1;
    const sMin = spiralOpts.circleSizeMin ?? 10;
    const sMax = spiralOpts.circleSizeMax ?? 100;
    const waveAmplitude = size * ampScale;
    const timeSpeed = snapLoopRate( rawTimeSpeed );
    // The angle's sin() multiplies the time term by angleScale before it
    // reaches the trig call, so the whole combined coefficient (not
    // timeSpeed alone) is what has to complete whole turns per loop.
    const angleTimeRate = snapLoopRate( rawTimeSpeed * angleScale / 2 );

    for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
      const lerpPosition = mappers.lerpVector(
        start,
        end,
        lerpIndex
      );
      const angle = p.map(
        p.sin( angleScale * ( lerpIndex + index / indexScale ) + time * angleTimeRate ),
        -1,
        1,
        -p.TAU,
        p.TAU
      );
      const waveIndex = angle + time * timeSpeed;
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
          64,
          360
        ),
        p.map(
          p.cos( angle + hueCadence ),
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
          64
        )
      );

      const s = p.map(
        p.sin( lerpIndex + time * timeSpeed + index / indexScale ),
        -1,
        1,
        sMin,
        sMax
      );
      const s2 = p.map(
        p.cos( lerpIndex + time * timeSpeed + index / indexScale ),
        -1,
        1,
        sMin,
        sMax
      );

      p.circle(
        lerpPosition.x - xOffset,
        lerpPosition.y - yOffset,
        s
      );
      p.circle(
        lerpPosition.x + xOffset,
        lerpPosition.y + yOffset,
        s2
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
