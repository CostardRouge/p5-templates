import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import {
  drawer,
  computeOpacityFactor,
  drawWobblyGrid,
  paletteStroke
} from "../_shared.js";

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};

  const bg = o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ];

  p.clear();
  p.background( ...bg );
  p.translate(
    p.width / 2,
    p.height / 2
  );

  const ll = o.lines?.length ?? 40;
  const constrainMargin = ll * 2 + 20;
  const gridTint = o.background?.tint ?? [
    128,
    128,
    255
  ];
  const gridAlpha = o.background?.alpha ?? 255;
  const gridColor = p.color(
    gridTint[ 0 ],
    gridTint[ 1 ],
    gridTint[ 2 ],
    gridAlpha
  );

  p.push();
  p.translate(
    -p.width / 2,
    -p.height / 2
  );
  drawWobblyGrid( {
    count: o.background?.gridCount ?? 7,
    time,
    strokeColor: gridColor,
    weight: o.background?.weight ?? 3
  } );
  p.pop();

  drawer(
    ( t ) => {
      const lerpMin = 0;
      const lerpMax = o.lines?.growing
        ? p.map(
          p.sin( t / 2 ),
          -1,
          1,
          0,
          p.TAU * 1.5
        )
        : p.TAU * 1.5;
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
      const w = p.map(
        lerpIndex,
        0,
        p.TAU * 1.5,
        0,
        p.width
      );
      const h = p.map(
        lerpIndex,
        0,
        p.TAU * 1.5,
        0,
        p.height
      );

      const x = converters.polar.get(
        p.sin.bind( p ),
        w,
        lerpIndex,
        1
      ) * p.cos( t * 2 + lerpIndex );
      const y = converters.polar.get(
        p.cos.bind( p ),
        h,
        lerpIndex,
        1
      ) * p.sin( t - lerpIndex );

      p.translate(
        p.constrain(
          x,
          -p.width / 2 + constrainMargin,
          p.width / 2 - constrainMargin
        ),
        p.constrain(
          y,
          -p.height / 2 + constrainMargin,
          p.height / 2 - constrainMargin
        )
      );

      const rotationCount = o.rotation?.count ?? 1;
      const rotationSpeed = o.rotation?.speed ?? 2;
      const rotationIndexMult = o.rotation?.indexMultiplier ?? 2;

      p.rotate( t * rotationSpeed + lerpIndex * rotationIndexMult * rotationCount );
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
      const palette = o.colors?.palette ?? "rainbow";

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
} );
