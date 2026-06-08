import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
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
    time, index, total
  ) {
    const p = getP5();
    const o = options.sketch ?? {};
    const spiralOpts = o.spiral ?? {};
    const motion = o.motion ?? {};
    const colorOpts = o.colors ?? {};

    const {
      position, size, start, end, weight, opacityFactor
    } = this;

    const timeSpeed = motion.timeSpeed ?? 1;
    const hueCadence = index + time * ( colorOpts.hueSpeed ?? 1 );
    const cadence = index / Math.max(
      1,
      total
    ) + time * timeSpeed;

    const waveAmpRange = spiralOpts.waveAmpRange ?? 1.5;
    const waveAmplitude = size * p.map(
      p.sin( time * timeSpeed ),
      -1,
      1,
      -waveAmpRange,
      waveAmpRange
    );

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const baseLerpSteps = spiralOpts.lerpSteps ?? 200;
    let lerpStep = 1 / baseLerpSteps;

    if ( index === 0 ) {
      lerpStep = 1 / mappers.circularIndex(
        cadence,
        motion.lerpStepsCycle ?? [
          5,
          10,
          20,
          40,
          80,
          100,
          150,
          150,
          150
        ]
      );
    }

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
        1,
        -p.PI,
        p.PI
      );
      const yOffset = p.map(
        p.cos( angle + time * timeSpeed * 2 ),
        -1,
        1,
        -p.PI,
        p.PI
      );
      const xOffset = p.map(
        p.sin( angle + time * timeSpeed ),
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

    p.pop();
  }
}

function rebuildShapes() {
  const p = getP5();
  const o = options.sketch ?? {};
  const layout = o.layout ?? {};
  const spiralOpts = o.spiral ?? {};
  const xCount = layout.xCount ?? 1;
  const yCount = layout.yCount ?? 2;
  const sizeDivisor = layout.sizeDivisor ?? 3.5;
  const axis = layout.axis ?? "vertical";
  const weightMin = spiralOpts.weightMin ?? 75;
  const weightMax = spiralOpts.weightMax ?? 250;
  const opacityMin = spiralOpts.opacityMin ?? 1;
  const opacityMax = spiralOpts.opacityMax ?? 6;

  const key = `${ xCount }x${ yCount }-${ sizeDivisor }-${ axis }-${ weightMin }-${ weightMax }-${ opacityMin }-${ opacityMax }-${ p.width }x${ p.height }`;

  if ( key === sketchState.lastLayout ) {
    return;
  }

  rebuildGrid( {
    state: sketchState,
    options: options.sketch,
    SpiralClass: Spiral,
    layoutKeySuffix: `${ weightMin }-${ weightMax }-${ opacityMin }-${ opacityMax }`,
    extraProps: ( {
      y, yCount: yc
    } ) => ( {
      weight: p.map(
        y,
        1,
        Math.max(
          1,
          yc
        ),
        weightMax,
        weightMin
      ),
      opacityFactor: p.map(
        y,
        1,
        Math.max(
          1,
          yc
        ),
        opacityMax,
        opacityMin
      )
    } )
  } );

  sketchState.lastLayout = key;
}

sketch.setup( () => {
  rebuildShapes();
} );

sketch.draw( ( time ) => {
  const p = getP5();

  rebuildShapes();

  p.clear();
  p.background( ...( options.sketch?.backgroundColor ?? [
    0
  ] ) );

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time,
    index,
    sketchState.shapes.length
  ) );

  renderTitle();
} );
