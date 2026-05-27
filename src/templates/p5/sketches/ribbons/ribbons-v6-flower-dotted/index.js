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

  p.translate(
    p.width / 2,
    p.height / 2
  );

  drawer(
    ( t ) => {
      const lerpMin = p.map(
        p.cos( t ),
        -1,
        1,
        -p.PI,
        0
      );
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
      const rotationIndexMult = o.rotation?.indexMultiplier ?? 2;
      const rotationTimeMult = o.rotation?.timeMultiplier ?? 2;

      p.rotate( p.cos( lerpIndex * rotationIndexMult - t * rotationTimeMult ) * rotationSpeed
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

      const c = p.map(
        p.sin( t + lerpIndex ),
        -1,
        1,
        -20,
        20
      );
      const foldCycle = o.shape?.foldCycle ?? [
        2,
        1,
        1,
        1,
        2
      ];
      const foldSpeed = o.shape?.foldSpeed ?? 0.5;
      const lineMax = p.PI / mappers.circularIndex(
        c + t * foldSpeed,
        foldCycle
      );
      const lineMin = -lineMax;
      const linesCount = o.lines?.maxCount ?? 2.5;
      const lineStep = ( lineMax - lineMin ) / linesCount;
      const hueSpeed = -t * ( o.colors?.hueSpeed ?? 2 );
      const palette = o.colors?.palette ?? "rainbow";
      const ll = o.lines?.length ?? 150;
      const dotMultX = o.shape?.dotMultX ?? 1;
      const dotMultY = o.shape?.dotMultY ?? 1;

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
          vector.y * dotMultX,
          vector.x * dotMultY
        );
        p.vertex(
          vector.y * dotMultX,
          vector.x * dotMultY
        );
        p.endShape();
        p.pop();
      }
    },
    time
  );

  renderTitle();
} );
