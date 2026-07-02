import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import animation from "@/p5/utils/animation.js";
import graphics from "@/p5/utils/graphics.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  drawer,
  computeOpacityFactor,
  drawRadialPattern,
  paletteStroke
} from "../_shared.js";

const sketchState = {
  pixilatedCanvas: null
};

sketch.setup( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  sketchState.pixilatedCanvas = graphics.createAutoResizableGraphics(
    p.width,
    p.height
  );
  sketchState.pixilatedCanvas.pixelDensity( o.background?.pixelDensity ?? 0.1 );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const buffer = sketchState.pixilatedCanvas;

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop (the raw
  // `time.seconds()` this draw loop used to receive never wraps, so nothing
  // driven by it could ever close the seam). Every rate multiplying it below
  // is rounded to a whole number of cycles per loop. NOTE: `buffer` below is
  // a persistent trail/feedback buffer (blurred + faded, never cleared) —
  // its accumulated content depends on the sketch's entire draw history, not
  // just the current progression, so it is NOT fixable by snapping (see
  // background text on trails/feedback buffers).
  const time = animation.angle;

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  if ( buffer ) {
    buffer.filter(
      p.BLUR,
      o.background?.blur ?? 2
    );
    buffer.background(
      0,
      0,
      0,
      o.background?.trailAlpha ?? 16
    );
    p.image(
      buffer,
      0,
      0
    );
  }

  const bgTint = o.background?.tint ?? [
    128,
    128,
    255
  ];

  // Radial background wobble only returns to its start offsets once per
  // loop when it is a WHOLE number of cycles — snapped to whole cycles per
  // loop.
  const bgAnimationCycles = Math.round( o.background?.animationSpeed ?? 0.25 );

  drawRadialPattern( {
    count: o.background?.linesAmount ?? 90,
    time: time * bgAnimationCycles,
    strokeColor: p.color(
      bgTint[ 0 ],
      bgTint[ 1 ],
      bgTint[ 2 ],
      o.background?.radialAlpha ?? 40
    ),
    strokeWeight: o.background?.linesWeight ?? 8,
    innerLerpStep: 0.1,
    radiusXMult: o.background?.radiusXMult ?? 1.5,
    radiusYMult: o.background?.radiusYMult ?? 2
  } );

  const targets = buffer
    ? [
      buffer,
      p
    ]
    : [
      p
    ];

  const foldCycle = o.shape?.foldCycle ?? [
    1,
    1.5,
    2,
    2,
    2.5,
    3,
    3.5,
    3.5,
    4,
    4,
    4
  ];
  const foldLerp = o.shape?.foldLerp ?? 0.0005;
  // NOT fixable by snapping: animation.sequence lerp-smooths toward its
  // target every frame and keeps that smoothed value in module state across
  // frames, so — like a physics follower — it never returns exactly to its
  // start value at the loop seam regardless of rate.
  const linesCount = animation.sequence(
    "ribbons-v14-fold",
    time / 2,
    foldCycle,
    foldLerp
  );

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
      _lerpIndex, _lMin, _lMax, _lStep, t, _idx, canvas
    ) => {
      canvas.translate(
        p.width / 2,
        p.height / 2
      );
      // Rotation is a raw rotate() argument (not wrapped in a trig
      // function), so it only returns to its start angle once per loop when
      // it is a WHOLE number of turns — snapped to whole turns per loop.
      const rotationTurns = Math.round( o.rotation?.speed ?? 0.5 );

      canvas.rotate( -t * rotationTurns );
    },
    (
      lerpIndex, _lMin, lerpMax, t, _idx, canvas
    ) => {
      const lineMin = -p.PI;
      const lineMax = p.PI;
      const lineStep = lineMax / Math.max(
        0.1,
        linesCount
      );
      // Hue scroll only returns to its start hue once per loop when it
      // completes a WHOLE number of cycles — snapped to whole cycles per
      // loop.
      const hueCycles = Math.round( o.colors?.hueSpeed ?? 2 );
      const hueSpeed = -t * hueCycles;
      const palette = o.colors?.palette ?? "rainbow";
      const ll = o.lines?.length ?? 190;
      const radiusGain = o.shape?.radiusGain ?? 1.5;
      const s = mappers.circularMap(
        lerpIndex,
        lineMax,
        0,
        ll * radiusGain
      );

      // Opacity oscillation only returns to its start value once per loop
      // when it completes a WHOLE number of cycles — snapped to whole
      // cycles per loop.
      const opacityCycles = Math.round( o.opacity?.speed ?? 2 );

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          s
        );

        const opacityFactor = computeOpacityFactor( {
          lerpIndex,
          lerpMax,
          time: t,
          opacityCount: o.opacity?.groupCount ?? 1,
          opacitySpeed: opacityCycles,
          startOpacity: o.opacity?.startFactor ?? 12,
          endOpacity: o.opacity?.endFactor ?? 1,
          lineIndex,
          pingPong: o.opacity?.pingPong ?? true
        } );

        canvas.push();
        canvas.strokeWeight( mappers.circularMap(
          lerpIndex,
          lineMax,
          10,
          o.lines?.weight ?? 110
        ) );
        paletteStroke( {
          canvas,
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

        canvas.beginShape();
        canvas.vertex(
          -vector.x,
          vector.y
        );
        canvas.vertex(
          -vector.y,
          -vector.x
        );
        canvas.endShape();
        canvas.pop();
      }
    },
    time,
    0,
    targets
  );

  renderTitle();
} );
