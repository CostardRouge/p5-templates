import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import converters from "@/p5/utils/converters.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  drawer,
  computeOpacityFactor,
  drawWobblyGrid
} from "../_shared.js";

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop (the raw
  // `time.seconds()` this draw loop used to receive never wraps, so nothing
  // driven by it could ever close the seam). Every rate multiplying it below
  // is rounded to a whole number of cycles per loop.
  const time = animation.angle;

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
  const gridCycles = Math.round( o.background?.animationSpeed ?? 0.25 );
  const a = Math.abs( p.cos( time * gridCycles ) );
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
    count: 1 + ( o.background?.gridCountA ?? 7 ) * a,
    time,
    strokeColor: gridColor,
    weight: o.background?.weight ?? 3
  } );
  drawWobblyGrid( {
    count: 1 + ( o.background?.gridCountB ?? 6.6 ) * a,
    time,
    strokeColor: gridColor,
    weight: o.background?.weight ?? 3
  } );
  p.pop();

  // The growing-line curve completes a WHOLE number of cos() cycles per loop
  // (previously half a cycle, which left the drawn length mismatched at the
  // seam) — snapped to whole cycles per loop.
  const growCycles = Math.round( 0.5 );

  drawer(
    ( t ) => {
      const lerpMin = 0;
      const lerpMax = o.lines?.growing
        ? p.map(
          p.cos( t * growCycles ),
          -1,
          1,
          0,
          p.TAU * 1.5
        )
        : p.TAU * 1.5;
      const quality = o.shape?.quality ?? 1000;
      const lerpStep = lerpMax / quality;

      return [
        lerpMin,
        lerpMax,
        lerpStep
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
      // Rotation speed only returns to its start angle once per loop when it
      // is a WHOLE number of turns — snapped to whole turns per loop.
      const rotationTurns = Math.round( o.rotation?.speed ?? 2 );
      const rotationIndexMult = o.rotation?.indexMultiplier ?? 2;

      p.rotate( t * rotationTurns + lerpIndex * rotationIndexMult * rotationCount );
    },
    (
      lerpIndex, _lMin, lerpMax, t
    ) => {
      // Opacity oscillation only returns to its start value once per loop
      // when it completes a WHOLE number of cycles — snapped to whole
      // cycles per loop.
      const opacityCycles = Math.round( o.opacity?.speed ?? -2 );
      const opacityCount = o.opacity?.groupCount ?? 2;
      const opacityFactor = computeOpacityFactor( {
        lerpIndex,
        lerpMax,
        time: t,
        opacityCount,
        opacitySpeed: opacityCycles,
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
      // Hue scroll only returns to its start hue once per loop when it
      // completes a WHOLE number of cycles — snapped to whole cycles per
      // loop.
      const hueCycles = Math.round( o.colors?.hueSpeed ?? 2 );
      const hueSpeed = -t * hueCycles;

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

        p.stroke( p.color(
          90 / opacityFactor,
          p.map(
            p.sin( hueSpeed - lerpIndex * 5 ),
            -1,
            1,
            128,
            0
          ) / opacityFactor,
          360 / opacityFactor
        ) );

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
