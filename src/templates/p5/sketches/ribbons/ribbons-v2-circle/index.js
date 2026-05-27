import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  drawer,
  computeOpacityFactor,
  drawConcentricCircles,
  paletteStroke
} from "../_shared.js";

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  const bgTint = o.background?.tint ?? [
    128,
    128,
    255
  ];

  drawConcentricCircles( {
    count: o.background?.count ?? 15,
    time: time * ( o.background?.animationSpeed ?? 1 ),
    strokeColor: p.color(
      bgTint[ 0 ],
      bgTint[ 1 ],
      bgTint[ 2 ],
      o.background?.alpha ?? 90
    ),
    maxWeight: o.background?.maxWeight ?? 50
  } );

  p.translate(
    p.width / 2,
    p.height / 2
  );

  const ll = o.lines?.length ?? 40;

  drawer(
    ( t ) => {
      const lerpMin = 0;
      const lerpMax = p.TAU;
      const quality = o.shape?.quality ?? 1000;

      return [
        lerpMin,
        lerpMax,
        lerpMax / quality
      ];
    },
    (
      lerpIndex, _lMin, _lMax, _lStep, t
    ) => {
      const w = p.width;
      const h = p.height;
      const radiusX = w / ( o.shape?.xDivisor ?? 2 );
      const radiusY = h / ( o.shape?.yDivisor ?? 4 );

      const x = converters.polar.get(
        p.sin.bind( p ),
        radiusX,
        lerpIndex,
        1
      );
      const y = converters.polar.get(
        p.cos.bind( p ),
        radiusY,
        lerpIndex,
        1
      );

      p.translate(
        x * p.cos( -t + lerpIndex ),
        y
      );

      const rotationCount = o.rotation?.count ?? 1;
      const rotationSpeed = o.rotation?.speed ?? 2;
      const wobbleSpeed = o.rotation?.wobbleSpeed ?? 0.5;
      const a = p.map(
        p.sin( t * wobbleSpeed ),
        -1,
        1,
        0,
        p.TAU
      );

      p.rotate( t * rotationSpeed + lerpIndex + a * rotationCount );
    },
    (
      lerpIndex, _lMin, lerpMax, t
    ) => {
      const opacityFactor = computeOpacityFactor( {
        lerpIndex,
        lerpMax,
        time: t,
        opacityCount: o.opacity?.groupCount ?? 2,
        opacitySpeed: o.opacity?.speed ?? -2,
        startOpacity: o.opacity?.startFactor ?? 3,
        endOpacity: o.opacity?.endFactor ?? 1,
        pingPong: o.opacity?.pingPong ?? true
      } );

      let linesCount = o.lines?.maxCount ?? 1;

      if ( o.lines?.changeCount ) {
        linesCount = p.map(
          p.cos( lerpIndex / 2 - t * 2 ),
          -1,
          1,
          1,
          o.lines?.maxCount ?? 1,
          true
        );
      }

      const lineMax = p.PI;
      const lineStep = lineMax / linesCount;
      const hueSpeed = -t * ( o.colors?.hueSpeed ?? 2 );
      const palette = o.colors?.palette ?? "purple";

      for ( let lineIndex = 0; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          p.map(
            lerpIndex,
            0,
            lerpMax,
            1,
            o.lines?.weight ?? 80,
            true
          )
        );

        p.push();
        p.strokeWeight( ll );
        paletteStroke( {
          canvas: p,
          paletteName: palette,
          hueSpeed,
          lerpIndex,
          opacityFactor
        } );

        p.beginShape();
        p.vertex(
          vector.x,
          vector.y
        );
        p.vertex(
          -vector.x,
          -vector.y
        );
        p.endShape();
        p.pop();
      }
    },
    time
  );

  renderTitle();
} );
