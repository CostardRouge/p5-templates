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
    count: o.background?.linesAmount ?? 90,
    time: time * bgAnimationCycles,
    strokeColor: p.color(
      bgTint[ 0 ],
      bgTint[ 1 ],
      bgTint[ 2 ],
      o.background?.alpha ?? 40
    ),
    strokeWeight: o.background?.weight ?? 4,
    innerLerpStep: 0.1,
    radiusXMult: o.background?.radiusXMult ?? 2,
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
      const quality = o.shape?.quality ?? 300;

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
          + lerpIndex * rotationIndexMult * rotationCount );
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

      const lineMin = -p.PI;
      const lineMax = p.PI;
      const foldCycle = o.shape?.foldCycle ?? [
        1,
        0.75,
        1.5,
        1
      ];
      // NOT fixable by snapping: animation.sequence lerp-smooths toward its
      // target every frame and keeps that smoothed value in module state
      // across frames, so — like a physics follower — it never returns
      // exactly to its start value at the loop seam regardless of rate.
      const v = animation.sequence(
        "ribbons-v9-fold",
        t / 2,
        foldCycle,
        o.shape?.foldLerp ?? 0.1
      );
      const lineStep = lineMax / Math.max(
        0.1,
        v
      );
      // Hue scroll only returns to its start hue once per loop when it
      // completes a WHOLE number of cycles — snapped to whole cycles per
      // loop.
      const hueCycles = Math.round( o.colors?.hueSpeed ?? 2 );
      const hueSpeed = -t * hueCycles;
      const palette = o.colors?.palette ?? "red";
      const ll = o.lines?.length ?? 150;
      const jitter = o.shape?.jitter ?? 15;
      const jitterFreq = o.shape?.jitterFreq ?? 7;

      const s = mappers.circularMap(
        lerpIndex,
        lineMax,
        -ll,
        ll
      );

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          s
        );

        const offX = jitter * p.sin( lerpIndex * jitterFreq + t );
        const offY = jitter * p.cos( lerpIndex * jitterFreq - t );

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
          vector.x + offX,
          vector.y + offY
        );
        p.vertex(
          vector.x + offX,
          vector.y + offY
        );
        p.endShape();
        p.pop();
      }
    },
    time
  );

  renderTitle();
} );
