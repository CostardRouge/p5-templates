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
  getVector(
    angle, time, waveAmplitude
  ) {
    const p = getP5();
    const xAngle = p.map(
      p.sin( angle - time / 2 ),
      -1,
      1,
      -p.PI,
      p.PI
    );
    const yAngle = p.map(
      p.cos( angle + time / 2 ),
      -1,
      1,
      -p.PI,
      p.PI
    );

    return p.createVector(
      converters.polar.get(
        p.sin.bind( p ),
        waveAmplitude,
        xAngle
      ),
      converters.polar.get(
        p.cos.bind( p ),
        waveAmplitude,
        yAngle
      )
    );
  }

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

    const timeSpeed = motion.timeSpeed ?? 1;
    const t = time * timeSpeed;
    const hueCadence = index + t * ( colorOpts.hueSpeed ?? 1 );

    const shadowsCount = spiralOpts.shadowsCount ?? 100;
    const weightMin = spiralOpts.weightMin ?? 40;
    const weightMax = spiralOpts.weightMax ?? 300;
    const opacityMin = spiralOpts.opacityMin ?? 1;
    const opacityMax = spiralOpts.opacityMax ?? 10;
    const angleSpokes = spiralOpts.angleSpokes ?? 10;
    const orbitRange = spiralOpts.orbitRange ?? 1;

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const angleStep = p.TAU / angleSpokes;
    const s = p.map(
      p.cos( t ),
      -1,
      1,
      -size * orbitRange,
      size * orbitRange
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

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        const polar = converters.polar.vector(
          angle,
          s
        );

        p.translate(
          polar.x,
          polar.y
        );

        const vector = this.getVector(
          angle,
          t,
          s
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
