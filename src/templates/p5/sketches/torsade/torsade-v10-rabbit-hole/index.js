import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  SpiralBase, snapLoopRate
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
    const rings = o.rings ?? {};
    const motion = o.motion ?? {};
    const colorOpts = o.colors ?? {};

    const {
      position, size
    } = this;
    // Loop-exact rates: raw time is the sketch's non-wrapping clock, so every
    // rate multiplying it is snapped to whole cycles per loop (see
    // ../_shared.js#snapLoopRate) — including the literal jitter rates below,
    // which aren't sliders but still need to close the loop.
    const hueCadence = index + time * snapLoopRate( colorOpts.hueSpeed ?? 1 );

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const shadowsCount = rings.shadowsCount ?? 30;
    const shadowIndexStep = rings.shadowIndexStep ?? 0.05;
    const angleSubdivisions = rings.angleSubdivisions ?? 14;
    const angleStep = p.TAU / angleSubdivisions;
    const radiusDivisorMin = rings.radiusDivisorMin ?? 0.2;
    const radiusDivisorMax = rings.radiusDivisorMax ?? 5;
    const weightMin = rings.weightMin ?? 20;
    const weightMax = rings.weightMax ?? 75;
    const shadowRotationRadians = rings.shadowRotationRadians ?? 7;
    const spinSpeed = snapLoopRate( motion.spinSpeed ?? 1 );
    const jitterAmount = motion.jitterAmount ?? 0.33;
    const jitterXRate = snapLoopRate( 2 );
    const jitterYRate = snapLoopRate( 1 );
    const opacityCurveSpeed = snapLoopRate( colorOpts.opacityCurveSpeed ?? 5 );
    const opacityMin = colorOpts.opacityMin ?? 1;
    const opacityMax = colorOpts.opacityMax ?? 15;

    for (
      let shadowIndex = 0;
      shadowIndex <= shadowsCount;
      shadowIndex += shadowIndexStep
    ) {
      const weight = p.map(
        shadowIndex,
        0,
        shadowsCount,
        weightMin,
        weightMax
      );

      p.translate(
        p.map(
          p.sin( time * jitterXRate ),
          -1,
          1,
          -jitterAmount,
          jitterAmount
        ),
        p.map(
          p.cos( time * jitterYRate ),
          -1,
          1,
          -jitterAmount,
          jitterAmount
        )
      );

      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();
        const dir = index % 2 ? -1 : 1;
        const vector = converters.polar.vector(
          angle + dir * time * spinSpeed - p.radians( shadowRotationRadians * shadowIndex ),
          size / p.map(
            shadowIndex,
            0,
            shadowsCount,
            radiusDivisorMax,
            radiusDivisorMin
          )
        );

        const opacityFactor = p.map(
          p.sin( shadowIndex / 5 - time * opacityCurveSpeed + angle * 2 ),
          -1,
          1,
          opacityMin,
          opacityMax
        );

        p.beginShape();
        p.strokeWeight( weight );
        p.stroke( p.color(
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
            360
          ) / opacityFactor,
          p.map(
            p.sin( angle + hueCadence ),
            -1,
            1,
            360,
            0
          ) / opacityFactor
        ) );

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

function rebuildShapes() {
  const p = getP5();
  const layout = options.sketch?.layout ?? {};
  const xCount = layout.xCount ?? 1;
  const yCount = layout.yCount ?? 1;
  const sizeDivisor = layout.sizeDivisor ?? 3;
  const key = `${ xCount }x${ yCount }-${ sizeDivisor }-${ p.width }x${ p.height }`;

  if ( key === sketchState.lastLayout ) {
    return;
  }
  sketchState.lastLayout = key;

  const size = ( p.width + p.height ) / ( xCount + yCount ) / sizeDivisor;

  sketchState.shapes = [];
  for ( let x = 1; x <= xCount; x++ ) {
    for ( let y = 1; y <= yCount; y++ ) {
      sketchState.shapes.push( new Spiral( {
        size,
        relativePosition: {
          x: x / ( xCount + 1 ),
          y: y / ( yCount + 1 )
        }
      } ) );
    }
  }
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
    index
  ) );

  renderTitle();
} );
