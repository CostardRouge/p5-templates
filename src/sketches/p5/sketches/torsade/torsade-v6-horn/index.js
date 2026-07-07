import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import {
  SpiralBase
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
    const horn = o.horn ?? {};
    const motion = o.motion ?? {};
    const colorOpts = o.colors ?? {};

    const {
      position, size, start, end
    } = this;

    const timeSpeed = motion.timeSpeed ?? 1;
    const t = p.sin( time * timeSpeed );
    const mult = p.map(
      t,
      -1,
      1,
      horn.waveMultMin ?? 3,
      horn.waveMultMax ?? 8
    );
    const waveAmplitude = mult * p.map(
      t,
      -1,
      1,
      horn.waveAmpMin ?? 0,
      size
    );
    const angleLimit = -p.PI;

    p.push();
    p.translate(
      position.x,
      position.y + p.width * ( horn.yShiftRatio ?? 0.5 )
    );

    const lerpSteps = horn.lerpSteps ?? 190;
    const lerpStep = 1 / lerpSteps;
    const angleScale = horn.angleScale ?? 10;
    const indexScale = motion.indexScale ?? 5;
    const cadenceMin = motion.cadenceMin ?? -4;
    const cadenceMax = motion.cadenceMax ?? 4;
    const cStart = horn.circleSizeStart ?? 200;
    const cEnd = horn.circleSizeEnd ?? 50;
    const wobble = motion.timeWobbleEnabled ?? true;
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

      const xOff = wobble
        ? p.map(
          p.sin( time * timeSpeed ),
          -1,
          1,
          -xOffset,
          xOffset
        )
        : xOffset;
      const yOff = wobble
        ? p.map(
          p.cos( time * timeSpeed ),
          -1,
          1,
          -yOffset,
          yOffset
        )
        : yOffset;
      const s = p.map(
        lerpIndex,
        0,
        1,
        cStart,
        cEnd
      );

      const colorTime = tt * cadenceContrib;

      p.fill(
        p.map(
          p.sin( angle + colorTime ),
          -1,
          1,
          0,
          360
        ),
        p.map(
          p.cos( angle + colorTime ),
          -1,
          1,
          0,
          255
        ),
        p.map(
          p.sin( angle + colorTime ),
          -1,
          1,
          255,
          0
        )
      );

      p.circle(
        lerpPosition.x + xOff,
        lerpPosition.y - yOff,
        s
      );
    }

    p.pop();
  }
}

function rebuildHorn() {
  const p = getP5();
  const layout = options.sketch?.layout ?? {};
  const xCount = layout.xCount ?? 6;
  const yCount = layout.yCount ?? 1;
  const sizeDivisor = layout.sizeDivisor ?? 3.5;
  const key = `${ xCount }x${ yCount }-${ sizeDivisor }-${ p.width }x${ p.height }`;

  if ( key === sketchState.lastLayout ) {
    return;
  }
  sketchState.lastLayout = key;

  const size = ( p.width + p.height ) / 2 / ( xCount + yCount ) / sizeDivisor;

  sketchState.shapes = [];

  for ( let x = 1; x <= xCount; x++ ) {
    for ( let y = 1; y <= yCount; y++ ) {
      sketchState.shapes.push( new Spiral( {
        size,
        start: p.createVector(
          0,
          -p.height / 2
        ),
        end: p.createVector(
          0,
          0
        ),
        relativePosition: {
          x: x / ( xCount + 1 ),
          y: y / ( yCount + 1 )
        }
      } ) );
    }
  }
}

sketch.setup( () => {
  rebuildHorn();
} );

sketch.draw( ( time ) => {
  const p = getP5();

  rebuildHorn();

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
