import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  drawer,
  computeOpacityFactor,
  drawCartesianGrid,
  paletteStroke
} from "../_shared.js";

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

  const bgTint = o.background?.tint ?? [
    255,
    255,
    255
  ];

  drawCartesianGrid( {
    columns: o.background?.columns ?? 3,
    rows: o.background?.rows ?? 3,
    time: time * ( o.background?.animationSpeed ?? 1 ),
    strokeColor: p.color(
      bgTint[ 0 ],
      bgTint[ 1 ],
      bgTint[ 2 ],
      o.background?.alpha ?? 5
    ),
    weight: o.background?.weight ?? 3
  } );

  p.translate(
    p.width / 2,
    p.height / 2
  );

  const margin = o.shape?.verticalMargin ?? 50;

  drawer(
    () => {
      const lerpMin = 0;
      const lerpMax = p.PI;
      const quality = o.shape?.quality ?? 200;

      return [
        lerpMin,
        lerpMax,
        lerpMax / quality
      ];
    },
    (
      lerpIndex, lerpMin, lerpMax, _lStep, t
    ) => {
      const a = p.map(
        p.sin( lerpIndex - t ),
        -1,
        1,
        0,
        o.shape?.driftAmplitude ?? 1.5
      );
      const orbitX = o.shape?.orbitX ?? 200;

      p.translate(
        orbitX * p.sin( lerpIndex - t + a ),
        p.map(
          lerpIndex,
          lerpMin,
          lerpMax,
          -p.height / 2 + margin,
          p.height / 2 - margin
        )
      );

      const rotationCount = o.rotation?.count ?? 1;
      const rotationSpeed = o.rotation?.speed ?? 2;

      p.rotate( p.sin( lerpIndex * 2 - t ) * rotationSpeed
          + lerpIndex * 2 * rotationCount );
    },
    (
      lerpIndex, _lMin, lerpMax, t
    ) => {
      const opacityFactor = computeOpacityFactor( {
        lerpIndex,
        lerpMax,
        time: t,
        opacityCount: o.opacity?.groupCount ?? 2,
        opacitySpeed: o.opacity?.speed ?? 3,
        startOpacity: o.opacity?.startFactor ?? 3,
        endOpacity: o.opacity?.endFactor ?? 1,
        pingPong: o.opacity?.pingPong ?? false
      } );

      let linesCount = o.lines?.maxCount ?? 8;

      if ( o.lines?.changeCount ) {
        linesCount = p.map(
          p.cos( lerpIndex / 2 - t ),
          -1,
          1,
          1,
          o.lines?.maxCount ?? 8,
          true
        );
      }

      const lineMax = p.PI;
      const lineStep = lineMax / linesCount;
      const hueSpeed = -t * ( o.colors?.hueSpeed ?? 2 );
      const palette = o.colors?.palette ?? "rainbow";
      const ll = o.lines?.length ?? 40;

      const c = p.map(
        p.sin( t + lerpIndex ),
        -1,
        1,
        -20,
        20
      );
      const lc = mappers.circularIndex(
        t + c,
        o.shape?.zCycle ?? [
          2,
          5,
          2,
          3,
          2,
          4,
          1
        ]
      ) / p.map(
        p.cos( lerpIndex / 2 - t ),
        -1,
        1,
        o.shape?.zDivisorMin ?? 2,
        o.shape?.zDivisorMax ?? 4
      );
      const lw = o.shape?.regularLengthValue ?? 1.5;
      const z = o.lines?.regularLength ? lw : lc;
      const s = mappers.circularMap(
        lerpIndex,
        lineMax,
        0,
        ll
      );

      for ( let lineIndex = 0; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          s * z
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
          -vector.y,
          -vector.x
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
