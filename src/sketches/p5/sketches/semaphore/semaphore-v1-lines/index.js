import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import {
  SemaphoreBase, rebuildGrid
} from "../_shared.js";

const sketchState = sketch.state( () => ( {
  shapes: [],
  lastLayout: ""
} ) );

class SemaphoreLines extends SemaphoreBase {
  draw(
    time, index
  ) {
    const p = getP5();
    const o = options.sketch ?? {};
    const spiralOpts = o.spiral ?? {};
    const colorOpts = o.colors ?? {};
    const motion = o.motion ?? {};

    const {
      position, size, yOffset
    } = this;

    const shadowsCount = spiralOpts.shadowsCount ?? 10;
    const weightStart = spiralOpts.weightStart ?? 1000;
    const weightEnd = spiralOpts.weightEnd ?? 75;
    const opacityStart = spiralOpts.opacityStart ?? 7;
    const opacityEnd = spiralOpts.opacityEnd ?? 1;
    const shadowOffsetDeg = spiralOpts.shadowOffsetDeg ?? 7;

    const divisorMin = motion.divisorMin ?? 1;
    const divisorMax = motion.divisorMax ?? 9;
    const divisorTimeScale = motion.divisorTimeScale ?? 0.25;
    const orbitTimeScale = motion.orbitTimeScale ?? 1;
    const lineTwistScale = motion.lineTwistScale ?? 1;

    const hueScale = colorOpts.hueScale ?? 360;
    const greenScale = colorOpts.greenScale ?? 255;
    const blueScale = colorOpts.blueScale ?? 255;

    const waveAmplitude = size;

    p.push();
    p.translate(
      position.x,
      position.y + yOffset
    );

    for ( let shadowIndex = 0; shadowIndex <= shadowsCount; shadowIndex++ ) {
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
        opacityStart,
        opacityEnd
      );
      const d = p.map(
        p.sin( time * divisorTimeScale ),
        -1,
        1,
        divisorMin,
        divisorMax
      );
      const angleStep = p.TAU / d;
      const shadowOffset = p.radians( shadowIndex * shadowOffsetDeg );

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        p.translate( converters.polar.vector(
          angle + time * orbitTimeScale + shadowOffset,
          size
        ) );

        const vector = this.getVector(
          angle,
          0,
          waveAmplitude
        );
        const nextVector = this.getVector(
          angle + angleStep,
          0,
          waveAmplitude
        );

        p.beginShape();
        p.strokeWeight( weight );

        p.stroke(
          p.map(
            p.sin( angle + shadowOffset ),
            -1,
            1,
            0,
            hueScale
          ) / opacityFactor,
          p.map(
            p.cos( angle + shadowOffset ),
            -1,
            1,
            0,
            greenScale
          ) / opacityFactor,
          p.map(
            p.sin( angle + shadowOffset ),
            -1,
            1,
            blueScale,
            0
          ) / opacityFactor
        );

        const twist = time * lineTwistScale;

        p.vertex(
          vector.x * p.sin( twist ),
          vector.y * p.cos( twist )
        );
        p.vertex(
          nextVector.x * p.cos( twist ),
          nextVector.y * p.cos( twist )
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
    SemaphoreClass: SemaphoreLines
  } );
} );

sketch.draw( ( time ) => {
  const p = getP5();

  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SemaphoreClass: SemaphoreLines
  } );

  const bg = options.sketch?.background?.color ?? [
    0
  ];

  p.clear();
  p.background( ...bg );

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time,
    index
  ) );
} );
