import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
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
    const rings = o.rings ?? {};
    const motion = o.motion ?? {};
    const colorOpts = o.colors ?? {};
    const endcap = o.endcap ?? {};

    const {
      position, size
    } = this;

    p.push();
    p.translate(
      position.x,
      position.y
    );

    const shadowsCount = rings.shadowsCount ?? 10;
    const shadowIndexStep = rings.shadowIndexStep ?? 0.03;
    const angleSubdivisions = rings.angleSubdivisions ?? 6;
    const angleStep = p.TAU / angleSubdivisions;
    const radiusDivisorMin = rings.radiusDivisorMin ?? 1;
    const radiusDivisorMax = rings.radiusDivisorMax ?? 5;
    const linesCount = rings.linesCount ?? 3;
    const lineSizeMin = rings.lineSizeMin ?? 50;
    const lineSizeMax = rings.lineSizeMax ?? 150;
    const spinSpeed = motion.spinSpeed ?? 1;
    const rotationSpeed = motion.rotationSpeed ?? 3;
    const rotationMaxMin = motion.rotationMaxMin ?? 1;
    const rotationMaxMax = motion.rotationMaxMax ?? 5;
    const opacityFalloffMin = colorOpts.opacityFalloffMin ?? 1;
    const opacityFalloffMax = colorOpts.opacityFalloffMax ?? 5;
    const weightMaxMin = colorOpts.weightMaxMin ?? 50;
    const weightMaxMax = colorOpts.weightMaxMax ?? 100;
    const endcapWeight = endcap.weight ?? 4;
    const endcapDarken = endcap.darken ?? 32;

    for (
      let shadowIndex = 0;
      shadowIndex <= shadowsCount;
      shadowIndex += shadowIndexStep
    ) {
      for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
        p.push();

        const angleVector = converters.polar.vector(
          angle - time * spinSpeed,
          size / p.map(
            shadowIndex,
            0,
            shadowsCount,
            radiusDivisorMax,
            radiusDivisorMin
          )
        );

        p.translate(
          angleVector.x,
          angleVector.y
        );

        const opacityFactor = mappers.circularMap(
          shadowIndex,
          shadowsCount * 4,
          p.map(
            p.sin( -time * 3 + angle * 2 ),
            -1,
            1,
            opacityFalloffMin,
            opacityFalloffMax
          ),
          1
        );

        const lineMin = 0;
        const lineMax = p.PI;
        const lineStep = lineMax / linesCount;

        p.push();
        const rotationMax = p.map(
          p.sin( time / 2 ),
          -1,
          1,
          rotationMaxMin,
          rotationMaxMax
        );

        p.rotate( -time * rotationSpeed + p.map(
          shadowIndex,
          0,
          shadowsCount,
          0,
          rotationMax
        ) );

        for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
          const vector = converters.polar.vector(
            lineIndex,
            p.map(
              p.sin( time ),
              -1,
              1,
              lineSizeMin,
              lineSizeMax,
              true
            )
          );

          p.beginShape();

          const hueSpeed = -time;
          const hueIndex = angle + shadowIndex / 1.5;
          const hue = p.color(
            p.map(
              p.sin( hueSpeed + hueIndex ),
              -1,
              1,
              0,
              360
            ) / opacityFactor,
            p.map(
              p.sin( hueSpeed - hueIndex ),
              -1,
              1,
              360,
              0
            ) / opacityFactor,
            p.map(
              p.sin( hueSpeed + hueIndex ),
              -1,
              1,
              360,
              0
            ) / opacityFactor
          );

          p.stroke( hue );

          if ( shadowIndex + shadowIndexStep >= shadowsCount ) {
            p.strokeWeight( endcapWeight );
            p.stroke(
              p.red( hue ) - endcapDarken,
              p.green( hue ) - endcapDarken,
              p.blue( hue ) - endcapDarken
            );
          }

          p.vertex(
            vector.x,
            vector.y
          );
          p.vertex(
            vector.x,
            vector.y
          );

          const wMax = p.map(
            p.sin( time ),
            -1,
            1,
            weightMaxMin,
            weightMaxMax
          );

          p.strokeWeight( p.map(
            shadowIndex,
            0,
            shadowsCount,
            0,
            wMax,
            true
          ) );

          p.endShape();
        }
        p.pop();

        p.pop();
      }
    }

    p.pop();
  }
}

function drawGlow( time ) {
  const p = getP5();
  const glow = options.sketch?.glow ?? {};

  if ( !( glow.enabled ?? true ) ) {
    return;
  }

  const count = glow.ringsCount ?? 15;
  const sizeMin = glow.sizeMin ?? 0.166;
  const sizeMax = glow.sizeMax ?? 1;
  const orbitRadius = glow.orbitRadius ?? 30;
  const orbitSpeed = glow.orbitSpeed ?? 5;
  const c = glow.color ?? [
    128,
    128,
    255
  ];

  p.noFill();
  p.strokeWeight( glow.strokeWeight ?? 4 );
  p.stroke( ...c );

  const size = p.map(
    -p.sin( time ),
    -1,
    1,
    p.width * sizeMin,
    p.width * sizeMax
  );
  const xOffset = p.sin( time * orbitSpeed ) * orbitRadius;
  const yOffset = p.cos( time * orbitSpeed ) * orbitRadius;

  for ( let i = 2; i < count; i++ ) {
    p.circle(
      p.width / 2 - xOffset,
      p.height / 2 - yOffset,
      i * size / 5 * i
    );
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

  drawGlow( time );

  sketchState.shapes.forEach( (
    shape, index
  ) => shape.draw(
    time,
    index
  ) );

  renderTitle();
} );
