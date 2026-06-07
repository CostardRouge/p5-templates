import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import traceLetters from "@/p5/utils/traceLetters.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  getAlphabet, drawGrid, drawShape, getFont, loopedTime
} from "../_shared.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

sketch.draw( (
  _t, center, favoriteColor
) => {
  const p = getP5();

  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );
  p.noFill();

  const time = loopedTime();
  const alphabet = getAlphabet( "infinite" );
  const font = getFont( options.sketch.textStyle?.font );

  const W = p.width / 2;
  const H = p.height / 2;
  const letterSize = ( options.sketch.textStyle?.size ?? 0.66 ) * p.width;
  const margin = letterSize / 2;

  const from = p.createVector(
    -W + margin,
    0
  );
  const to = p.createVector(
    W - margin,
    0
  );

  if ( options.sketch.grid?.show ) {
    p.push();
    p.translate(
      -W,
      -H
    );
    drawGrid( {
      xCount: options.sketch.grid?.columns ?? 20,
      yCount: options.sketch.grid?.rows ?? 26,
      color: favoriteColor,
      weight: options.sketch.grid?.weight ?? 0.5
    } );
    p.pop();
  }

  p.translate(
    0,
    0,
    50
  );

  const sampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.15;
  const steps = options.sketch.traced?.steps ?? alphabet.length * 2;

  const start = [];
  const end = [];

  const lettersSpeed = options.sketch.letters?.speed ?? 1;

  const letterValues = traceLetters.points( {
    texts: alphabet,
    size: letterSize,
    position: center,
    sampleFactor,
    font
  } );

  mappers.traceVectors(
    steps,
    ( progression ) => traceLetters.morph( {
      values: letterValues,
      duration: 1,
      easingFn: easing.easeInOutQuart,
      // loop-safe: sweep the whole text once (× speed) per loop, instead of
      // `+ time` which only advanced ~1 glyph per loop
      currentTime: p.map(
        progression,
        0,
        1,
        0,
        ( alphabet.length - 1 ) / alphabet.length
      ) + traceLetters.sweep(
        animation.progression,
        alphabet.length,
        lettersSpeed
      )
    } ),
    () => p.beginShape( p.TRIANGLE_FAN ),
    (
      vector, vectorsListProgression
    ) => {
      const position = mappers.lerpVector(
        from,
        to,
        vectorsListProgression
      );

      const z = animation.ease( {
        values: [
          -H / 4,
          H / 4
        ],
        duration: 1,
        easingFn: easing.easeInOutExpo,
        currentTime:
          p.noise(
            vectorsListProgression + time,
            vector.y / ( H / 2 ),
            vector.x / ( W / 2 )
          ) +
          time +
          vectorsListProgression
      } );

      position.add( vector );

      const x = position.x + z / 4;
      const y = position.y + z;

      if ( vectorsListProgression === 1 ) {
        end.push( p.createVector(
          x,
          y
        ) );
      }

      if ( vectorsListProgression === 0 ) {
        start.push( p.createVector(
          x,
          y
        ) );
      }

      p.vertex(
        x,
        y
      );
    },
    ( vectorIndexProgression ) => {
      const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 6;

      p.stroke( colors.rainbow( {
        hueOffset: time + ( options.sketch.colors?.hueOffset ?? 0 ),
        hueIndex:
          mappers.fn(
            p.noise(
              vectorIndexProgression * 8,
              vectorIndexProgression * p.cos( time + vectorIndexProgression )
            ),
            0,
            1,
            -p.PI / 2,
            p.PI / 2
          ) * hueIndexMultiplier,
        opacityFactor: p.map(
          p.sin( time + vectorIndexProgression * 16 ),
          -1,
          1,
          options.sketch.colors?.opacityMax ?? 3.5,
          options.sketch.colors?.opacityMin ?? 1.5
        )
      } ) );

      p.strokeWeight( options.sketch.traced?.weight ?? 4 );
      p.endShape();
    }
  );

  p.stroke( favoriteColor );
  p.strokeWeight( options.sketch.extremes?.weight ?? 4 );
  drawShape( end );
  drawShape( start );

  renderTitle();
} );
