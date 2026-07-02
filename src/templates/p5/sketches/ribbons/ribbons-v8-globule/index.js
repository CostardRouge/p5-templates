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
  drawRadialPattern,
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
    90,
    80
  ];

  // Radial background wobble only returns to its start offsets once per
  // loop when it is a WHOLE number of cycles — snapped to whole cycles per
  // loop.
  const bgAnimationCycles = Math.round( o.background?.animationSpeed ?? 0.5 );

  drawRadialPattern( {
    count: o.background?.linesAmount ?? 80,
    time: time * bgAnimationCycles,
    strokeColor: p.color(
      bgTint[ 0 ],
      bgTint[ 1 ],
      bgTint[ 2 ],
      o.background?.alpha ?? 60
    ),
    strokeWeight: o.background?.weight ?? 5,
    innerLerpStep: 0.1,
    radiusXMult: o.background?.radiusXMult ?? 1.5,
    radiusYMult: o.background?.radiusYMult ?? 2
  } );

  p.translate(
    p.width / 2,
    p.height / 2
  );

  drawer(
    () => {
      const lerpMin = 0;
      const lerpMax = p.PI * ( o.shape?.spreadFraction ?? 0.5 );
      const quality = o.shape?.quality ?? 350;

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
      // Both feed a rotation argument directly (drift isn't wrapped in a
      // trig function at all), so each only returns to its start angle once
      // per loop when it is a WHOLE number of turns — snapped to whole
      // turns per loop.
      const rotationTimeMult = Math.round( o.rotation?.timeMultiplier ?? 2 );
      const driftTurns = Math.round( o.rotation?.drift ?? 0.75 );

      p.rotate( p.cos( lerpIndex * rotationIndexMult - t * rotationTimeMult ) * rotationSpeed
          + lerpIndex * rotationCount );
      p.rotate( -t * driftTurns );
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

      const lineSpread = p.PI * ( o.shape?.lineSpreadFraction ?? 0.5 );
      const lineMin = -lineSpread;
      const lineMax = lineSpread;
      const linesCount = o.lines?.maxCount ?? 2.5;
      const lineStep = ( lineMax - lineMin ) / linesCount;
      // Hue scroll only returns to its start hue once per loop when it
      // completes a WHOLE number of cycles — snapped to whole cycles per
      // loop.
      const hueCycles = Math.round( o.colors?.hueSpeed ?? 2 );
      const hueSpeed = -t * hueCycles;
      const palette = o.colors?.palette ?? "red";
      const ll = o.lines?.length ?? 150;
      const radiusGain = o.shape?.radiusGain ?? 1.5;

      const s = mappers.circularMap(
        lerpIndex,
        lineMax,
        0,
        ll
      );

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          s * radiusGain
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
