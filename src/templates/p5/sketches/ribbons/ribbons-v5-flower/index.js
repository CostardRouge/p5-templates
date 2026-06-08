import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import iterators from "@/p5/utils/iterators.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  drawer,
  computeOpacityFactor,
  paletteStroke
} from "../_shared.js";

function drawClosedRadial( {
  time,
  strokeColor,
  weight = 4,
  polygonCount = 10,
  innerRadius = 275,
  outerRadiusFactor = 1.2,
  vertexResolution = 64
} ) {
  const p = getP5();

  p.push();
  p.noFill();
  p.stroke( strokeColor );
  p.strokeWeight( weight );

  for ( let i = 0; i < polygonCount; i++ ) {
    p.beginShape();

    const s = p.map(
      i,
      0,
      polygonCount,
      innerRadius,
      p.width * outerRadiusFactor
    );

    iterators.angle(
      0,
      p.TAU,
      p.TAU / vertexResolution,
      ( angle ) => {
        p.vertex(
          s * p.sin( angle ),
          s * p.cos( angle )
        );
      }
    );

    p.endShape( p.CLOSE );
  }

  p.pop();
}

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  p.translate(
    p.width / 2,
    p.height / 2
  );

  const bgTint = o.background?.tint ?? [
    128,
    128,
    255
  ];

  drawClosedRadial( {
    time: time * ( o.background?.animationSpeed ?? 0.25 ),
    strokeColor: p.color(
      bgTint[ 0 ],
      bgTint[ 1 ],
      bgTint[ 2 ],
      o.background?.alpha ?? 128
    ),
    weight: o.background?.weight ?? 4,
    polygonCount: o.background?.polygonCount ?? 10,
    innerRadius: o.background?.innerRadius ?? 275,
    outerRadiusFactor: o.background?.outerRadiusFactor ?? 1.2,
    vertexResolution: o.background?.vertexResolution ?? 64
  } );

  drawer(
    () => {
      const lerpMin = 0;
      const lerpMax = p.PI;
      const quality = o.shape?.quality ?? 400;

      return [
        lerpMin,
        lerpMax,
        lerpMax / quality
      ];
    },
    (
      lerpIndex, _lMin, _lMax, _lStep, t
    ) => {
      const rotationCount = o.rotation?.count ?? 1;
      const rotationSpeed = o.rotation?.speed ?? 1;

      p.rotate( p.cos( lerpIndex * 2 - t * 2 ) * rotationSpeed
          + lerpIndex * rotationCount );
    },
    (
      lerpIndex, _lMin, lerpMax, t
    ) => {
      const opacityFactor = computeOpacityFactor( {
        lerpIndex,
        lerpMax,
        time: t,
        opacityCount: o.opacity?.groupCount ?? 6,
        opacitySpeed: o.opacity?.speed ?? 3,
        startOpacity: o.opacity?.startFactor ?? 3,
        endOpacity: o.opacity?.endFactor ?? 1,
        pingPong: o.opacity?.pingPong ?? false
      } );

      let linesCount = o.lines?.maxCount ?? 2.5;

      if ( o.lines?.changeCount ) {
        linesCount = p.map(
          p.cos( lerpIndex / 2 - t ),
          -1,
          1,
          1,
          o.lines?.maxCount ?? 2.5,
          true
        );
      }

      const lineMin = -p.PI;
      const lineMax = p.PI;
      const lineStep = lineMax / linesCount;
      const hueSpeed = -t * ( o.colors?.hueSpeed ?? 2 );
      const palette = o.colors?.palette ?? "rainbow";
      const ll = o.lines?.length ?? 150;

      const s = mappers.circularMap(
        lerpIndex,
        lineMax,
        0,
        ll
      );

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          s
        );

        p.push();
        p.strokeWeight( mappers.circularMap(
          lerpIndex,
          lineMax,
          10,
          o.lines?.weight ?? 80
        ) );
        paletteStroke( {
          canvas: p,
          paletteName: palette,
          hueSpeed,
          lerpIndex,
          opacityFactor,
          alpha: mappers.circularMap(
            lerpIndex,
            lerpMax,
            1,
            255
          )
        } );

        p.beginShape();
        p.vertex(
          vector.y,
          vector.x
        );
        p.vertex(
          vector.y,
          vector.x
        );
        p.endShape();
        p.pop();
      }
    },
    time
  );

  renderTitle();
} );
