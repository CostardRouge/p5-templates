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
  drawCartesianGrid,
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

  const bgTint = o.background?.tint ?? [
    255,
    255,
    255
  ];

  // Background grid wobble only returns to its start offsets once per loop
  // when it is a WHOLE number of cycles — snapped to whole cycles per loop.
  const bgAnimationCycles = Math.round( o.background?.animationSpeed ?? 1 );

  drawCartesianGrid( {
    columns: o.background?.columns ?? 3,
    rows: o.background?.rows ?? 3,
    time: time * bgAnimationCycles,
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

  drawer(
    ( t ) => {
      // Breath oscillation only returns to its start value once per loop
      // when it is a WHOLE number of cycles — snapped to whole cycles per
      // loop.
      const breathCycles = Math.round( o.shape?.breathSpeed ?? 1 );
      const lerpMin = p.map(
        p.cos( t * breathCycles ),
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

      p.rotate( p.cos( lerpIndex * 2 - t * 2 ) * rotationSpeed
          + lerpIndex * rotationCount );
    },
    (
      lerpIndex, lerpMin, lerpMax, t
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

      const petalsCycle = o.shape?.petalsCycle ?? [
        2,
        1,
        2
      ];
      const stepCycle = o.shape?.stepCycle ?? [
        2,
        5,
        3,
        2,
        4,
        1
      ];

      // mappers.circularIndex steps discretely through petalsCycle/stepCycle
      // by truncating its index argument, so each only returns to its start
      // entry once per loop when the clock advances a WHOLE number of the
      // array's length in steps — snapped to whole cycles per loop.
      const petalsCyclesPerLoop = Math.round( p.TAU / petalsCycle.length );
      const petalsClock = animation.progression * petalsCyclesPerLoop * petalsCycle.length;
      const stepCyclesPerLoop = Math.round( p.TAU / stepCycle.length );
      const stepClock = animation.progression * stepCyclesPerLoop * stepCycle.length;
      const lineMax = p.PI / mappers.circularIndex(
        petalsClock,
        petalsCycle
      );
      const lineStep = lineMax / mappers.circularIndex(
        stepClock,
        stepCycle
      );
      // Hue scroll only returns to its start hue once per loop when it
      // completes a WHOLE number of cycles — snapped to whole cycles per
      // loop.
      const hueCycles = Math.round( o.colors?.hueSpeed ?? 2 );
      const hueSpeed = -t * hueCycles;
      const palette = o.colors?.palette ?? "rainbow";
      const ll = o.lines?.length ?? 100;

      const s = mappers.circularMap(
        lerpIndex,
        lineMax,
        0,
        ll
      );

      for ( let lineIndex = 0; lineIndex < lineMax; lineIndex += lineStep ) {
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
