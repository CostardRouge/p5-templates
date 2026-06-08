import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import iterators from "@/p5/utils/iterators.js";
import easing from "@/p5/utils/easing.js";
import graphics from "@/p5/utils/graphics.js";
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

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};
  const buffer = sketchState.pixilatedCanvas;

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

  drawRadialPattern( {
    count: o.background?.linesAmount ?? 100,
    time: time * ( o.background?.animationSpeed ?? 0.25 ),
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
  const hueSpeed = time * ( o.colors?.hueSpeed ?? 2 );
  const sweepDriftSpeed = o.shape?.sweepDriftSpeed ?? 0.25;
  const lerpAmpMin = o.shape?.lerpAmpMin ?? 0.5;
  const lerpAmpMax = o.shape?.lerpAmpMax ?? 1;
  const strokeMin = o.lines?.weightMin ?? 3;
  const strokeMax = o.lines?.weightMax ?? 70;
  const functionChangeSpeed = o.colors?.easingChangeSpeed ?? 1;
  const functionAngleDivisor = o.colors?.easingAngleDivisor ?? 5;
  const palette = o.colors?.palette ?? "rainbow";
  const paletteFn = resolvePalette( palette );

  iterators.angle(
    0,
    p.TAU,
    p.TAU / rayCount,
    ( angle ) => {
      const edge = converters.polar.vector(
        angle - time * sweepDriftSpeed,
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
            time * functionChangeSpeed + angle / functionAngleDivisor,
            easingFunctions
          );

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
              p.sin( time * ( o.opacity?.speed ?? 2 )
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
