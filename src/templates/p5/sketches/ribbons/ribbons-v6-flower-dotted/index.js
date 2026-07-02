import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  drawer,
  computeOpacityFactor,
  paletteStroke
} from "../_shared.js";

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop (the raw
  // `time.seconds()` this draw loop used to receive never wraps, so nothing
  // driven by it could ever close the seam). Every rate multiplying it below
  // is rounded to a whole number of cycles per loop.
  const time = animation.angle;

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
      // The time multiplier is the argument to cos(), so it only returns to
      // its start value once per loop when it is a WHOLE number of turns —
      // snapped to whole turns per loop.
      const rotationTimeMult = Math.round( o.rotation?.timeMultiplier ?? 2 );

      p.rotate( p.cos( lerpIndex * rotationIndexMult - t * rotationTimeMult ) * rotationSpeed
          + lerpIndex * rotationCount );
    },
    (
      lerpIndex, _lMin, lerpMax, t
    ) => {
      // Opacity oscillation only returns to its start value once per loop
      // when it completes a WHOLE number of cycles — snapped to whole
      // cycles per loop.
      const opacityCycles = Math.round( o.opacity?.speed ?? 3 );
      const opacityFactor = computeOpacityFactor( {
        lerpIndex,
        lerpMax,
        time: t,
        opacityCount: o.opacity?.groupCount ?? 6,
        opacitySpeed: opacityCycles,
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

      // mappers.circularIndex steps discretely through foldCycle by
      // truncating its index argument, so it only returns to its start
      // entry once per loop when the fold clock advances a WHOLE number of
      // foldCycle-length steps — snapped to whole cycles per loop.
      const foldSpeedRaw = o.shape?.foldSpeed ?? 0.5;
      const foldCyclesPerLoop = Math.round( foldSpeedRaw * p.TAU / foldCycle.length );
      const foldClock = animation.progression * foldCyclesPerLoop * foldCycle.length;
      const lineMax = p.PI / mappers.circularIndex(
        c + foldClock,
        foldCycle
      );
      const lineMin = -lineMax;
      const linesCount = o.lines?.maxCount ?? 2.5;
      const lineStep = ( lineMax - lineMin ) / linesCount;
      // Hue scroll only returns to its start hue once per loop when it
      // completes a WHOLE number of cycles — snapped to whole cycles per
      // loop.
      const hueCycles = Math.round( o.colors?.hueSpeed ?? 2 );
      const hueSpeed = -t * hueCycles;
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
