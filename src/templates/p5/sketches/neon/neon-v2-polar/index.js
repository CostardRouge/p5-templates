import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
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
  cachedColors = {};

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

  getCachedColor(
    angle, hueCadence, opacityFactor
  ) {
    const p = getP5();
    const colorKey = `${ angle }-${ hueCadence }-${ opacityFactor }`;

    if ( this.cachedColors[ colorKey ] ) {
      return this.cachedColors[ colorKey ];
    }

    return ( this.cachedColors[ colorKey ] = p.color(
      p.map(
        p.sin( angle + hueCadence ),
        -1,
        1,
        0,
        360
      ) / opacityFactor,
      p.map(
        p.cos( angle ),
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
    ) );
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

    const shadowsCount = spiralOpts.shadowsCount ?? 3;
    const weightMin = spiralOpts.weightMin ?? 75;
    const weightMax = spiralOpts.weightMax ?? 200;
    const opacityMin = spiralOpts.opacityMin ?? 1;
    const opacityMax = spiralOpts.opacityMax ?? 6;
    const angleStepsMin = spiralOpts.angleStepsMin ?? 64;
    const angleStepsMax = spiralOpts.angleStepsMax ?? 200;
    const useCachedColor = colorOpts.useCached ?? true;
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
      const angleSteps = p.map(
        shadowIndex,
        0,
        Math.max(
          1,
          shadowsCount
        ),
        angleStepsMin,
        angleStepsMax
      );
      const angleStep = p.TAU / angleSteps;

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        const polar = converters.polar.vector(
          angle,
          size
        );

        p.translate(
          polar.x,
          polar.y
        );

        const vector = this.getVector(
          angle,
          t,
          waveAmplitude
        );
        const nextVector = this.getVector(
          angle + t,
          0,
          waveAmplitude
        );

        p.beginShape();
        p.strokeWeight( weight );

        if ( useCachedColor ) {
          p.stroke( this.getCachedColor(
            angle,
            hueCadence,
            opacityFactor
          ) );
        } else {
          p.stroke(
            p.map(
              p.sin( angle + hueCadence ),
              -1,
              1,
              0,
              360
            ) / opacityFactor,
            p.map(
              p.cos( angle ),
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
        }

        p.vertex(
          p.map(
            p.cos( t ),
            -1,
            1,
            -vector.x,
            vector.x
          ),
          p.map(
            p.sin( t ),
            -1,
            1,
            -vector.x,
            vector.y
          )
        );
        p.vertex(
          p.map(
            p.sin( t ),
            -1,
            1,
            -nextVector.x,
            nextVector.x
          ),
          p.map(
            p.cos( t ),
            -1,
            1,
            -nextVector.y,
            nextVector.y
          )
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
