import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import iterators from "@/p5/utils/iterators.js";
import easing from "@/p5/utils/easing.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  drawRadialPattern,
  resolvePalette
} from "../_shared.js";

const sketchState = {
  pixilatedCanvas: null
};

const easingFunctions = Object.entries( easing );

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
    count: o.background?.linesAmount ?? 100,
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

  p.push();
  p.translate(
    p.width / 2,
    p.height / 2
  );

  const rayCount = o.shape?.rayCount ?? 20;
  const lerpStep = o.shape?.lerpStep ?? 0.01;
  const sizeDivisor = o.shape?.sizeDivisor ?? 10;
  const center = p.createVector(
    0,
    0
  );
  const size = ( p.width + p.height ) / sizeDivisor;
  // Hue scroll only returns to its start hue once per loop when it
  // completes a WHOLE number of cycles — snapped to whole cycles per loop.
  const hueCycles = Math.round( o.colors?.hueSpeed ?? 2 );
  const hueSpeed = time * hueCycles;
  // The sweep angle only returns to its start position once per loop when
  // it is a WHOLE number of turns — snapped to whole turns per loop.
  const sweepDriftTurns = Math.round( o.shape?.sweepDriftSpeed ?? 0.25 );
  const lerpAmpMin = o.shape?.lerpAmpMin ?? 0.5;
  const lerpAmpMax = o.shape?.lerpAmpMax ?? 1;
  const strokeMin = o.lines?.weightMin ?? 3;
  const strokeMax = o.lines?.weightMax ?? 70;
  const functionChangeSpeed = o.colors?.easingChangeSpeed ?? 1;
  const functionAngleDivisor = o.colors?.easingAngleDivisor ?? 5;
  const palette = o.colors?.palette ?? "rainbow";
  const paletteFn = resolvePalette( palette );

  // mappers.circularIndex steps discretely through easingFunctions by
  // truncating its index argument, so it only returns to its start entry
  // once per loop when the easing clock advances a WHOLE number of
  // easingFunctions-length steps — snapped to whole cycles per loop.
  const easingCyclesPerLoop = Math.round( functionChangeSpeed * p.TAU / easingFunctions.length );
  const easingClock = animation.progression * easingCyclesPerLoop * easingFunctions.length;

  iterators.angle(
    0,
    p.TAU,
    p.TAU / rayCount,
    ( angle ) => {
      const edge = converters.polar.vector(
        angle - time * sweepDriftTurns,
        size
      );

      const movingPart = edge.copy().lerp(
        center,
        p.map(
          p.cos( time + angle ),
          -1,
          1,
          lerpAmpMin,
          lerpAmpMax
        )
      );

      iterators.vector(
        edge,
        movingPart,
        lerpStep,
        (
          vector, vectorIndex
        ) => {
          const [
            ,
            easingFunction
          ] = mappers.circularIndex(
            easingClock + angle / functionAngleDivisor,
            easingFunctions
          );

          // Opacity oscillation only returns to its start value once per
          // loop when it completes a WHOLE number of cycles — snapped to
          // whole cycles per loop.
          const opacityCycles = Math.round( o.opacity?.speed ?? 2 );
          const opacityFactor = mappers.circularMap(
            p.map(
              p.sin( -time + vectorIndex + angle ),
              -1,
              1,
              0,
              1
            ),
            1,
            p.map(
              p.sin( time * opacityCycles
                + vectorIndex * ( o.opacity?.groupCount ?? 1 ) ),
              -1,
              1,
              o.opacity?.startFactor ?? 3,
              o.opacity?.endFactor ?? 1
            ),
            o.opacity?.endFactor ?? 1
          );

          const hueIndex = time + angle;

          if ( palette === "rainbow" ) {
            p.stroke(
              p.map(
                p.sin( hueSpeed + hueIndex ),
                -1,
                1,
                0,
                360
              ) / opacityFactor,
              p.map(
                p.cos( hueSpeed - hueIndex ),
                -1,
                1,
                360,
                0
              ) / opacityFactor,
              p.map(
                p.sin( hueSpeed + hueIndex ),
                -1,
                1,
                360,
                0
              ) / opacityFactor
            );
          } else {
            p.stroke( paletteFn(
              hueSpeed,
              hueIndex,
              opacityFactor,
              255
            ) );
          }

          p.strokeWeight( mappers.fn(
            vectorIndex,
            0,
            1,
            strokeMax,
            strokeMin,
            easingFunction
          ) );

          p.point(
            vector.x,
            vector.y
          );
        }
      );
    }
  );
  p.pop();

  renderTitle();
} );
