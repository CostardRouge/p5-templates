import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";
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
  const density = o.background?.pixelDensity ?? 0.1;

  sketchState.pixilatedCanvas = graphics.createAutoResizableGraphics(
    p.width,
    p.height
  );
  sketchState.pixilatedCanvas.pixelDensity( density );
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
    count: o.background?.linesAmount ?? 141,
    time: time * bgAnimationCycles,
    strokeColor: p.color(
      bgTint[ 0 ],
      bgTint[ 1 ],
      bgTint[ 2 ],
      o.background?.radialAlpha ?? 40
    ),
    strokeWeight: o.background?.linesWeight ?? 10,
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

  drawer(
    () => {
      const lerpMin = 0;
      const lerpMax = p.PI;
      const quality = o.shape?.quality ?? 150;

      return [
        lerpMin,
        lerpMax,
        lerpMax / quality
      ];
    },
    (
      lerpIndex, _lMin, _lMax, _lStep, t, _idx, canvas
    ) => {
      canvas.translate(
        p.width / 2,
        p.height / 2
      );
      const wobble = o.rotation?.wobble ?? 0.5;

      canvas.rotate( p.cos( t ) * wobble );

      const rotationCount = o.rotation?.count ?? 0.1;
      const rotationSpeed = o.rotation?.speed ?? 0;
      const rotationIndexMult = o.rotation?.indexMultiplier ?? 3;

      canvas.rotate( rotationSpeed
          + lerpIndex * rotationIndexMult * rotationCount * p.cos( t ) );
    },
    (
      lerpIndex, _lMin, lerpMax, t, _idx, canvas
    ) => {
      // Opacity oscillation only returns to its start value once per loop
      // when it completes a WHOLE number of cycles — snapped to whole
      // cycles per loop.
      const opacityCycles = Math.round( o.opacity?.speed ?? 2 );
      const opacityFactor = computeOpacityFactor( {
        lerpIndex,
        lerpMax,
        time: t,
        opacityCount: o.opacity?.groupCount ?? 1,
        opacitySpeed: opacityCycles,
        startOpacity: o.opacity?.startFactor ?? 12,
        endOpacity: o.opacity?.endFactor ?? 1,
        pingPong: o.opacity?.pingPong ?? true
      } );

      let linesCount = o.lines?.maxCount ?? 3;

      if ( o.lines?.changeCount ) {
        linesCount = p.map(
          p.cos( lerpIndex / 2 - t ),
          -1,
          1,
          1,
          o.lines?.maxCount ?? 3,
          true
        );
      }

      const c = p.map(
        p.sin( t + lerpIndex ),
        -1,
        1,
        -20,
        20
      );
      const zCycle = o.shape?.zCycle ?? [
        2,
        5,
        2,
        3,
        2,
        4,
        1
      ];

      // mappers.circularIndex steps discretely through zCycle by truncating
      // its index argument, so it only returns to its start entry once per
      // loop when the clock advances a WHOLE number of zCycle-length steps —
      // snapped to whole cycles per loop.
      const zCyclesPerLoop = Math.round( p.TAU / zCycle.length );
      const zClock = animation.progression * zCyclesPerLoop * zCycle.length;
      const lc = mappers.circularIndex(
        zClock + c,
        zCycle
      ) / 3;
      const lw = 1.5;
      const z = o.lines?.regularLength ? lw : lc;

      const lineMin = -p.PI;
      const lineMax = p.PI;
      const lineStep = lineMax / linesCount;
      // Hue scroll only returns to its start hue once per loop when it
      // completes a WHOLE number of cycles — snapped to whole cycles per
      // loop.
      const hueCycles = Math.round( o.colors?.hueSpeed ?? 2 );
      const hueSpeed = -t * hueCycles;
      const palette = o.colors?.palette ?? "rainbow";
      const ll = o.lines?.length ?? 190;
      const s = mappers.circularMap(
        lerpIndex,
        lineMax,
        0,
        ll
      );

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          s * z
        );

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
          vector.x,
          vector.y
        );
        canvas.vertex(
          vector.x,
          vector.y
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
