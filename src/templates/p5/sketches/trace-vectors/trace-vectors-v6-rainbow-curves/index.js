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
  drawGrid, drawShape, getFont, loopedTime
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

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );
  p.noFill();

  const time = loopedTime();
  const tx = options.sketch.text ?? {};
  const words = tx.mode === "multiple" && Array.isArray( tx.value ) && tx.value.length
    ? tx.value
    : ( typeof tx.value === "string" && tx.value.length
      ? [
        tx.value
      ]
      : [
        "rainbow",
        "curves"
      ] );

  const font = getFont( options.sketch.textStyle?.font );

  const W = p.width / 2;
  const H = p.height / 2;
  const letterSize = ( options.sketch.textStyle?.size ?? 0.143 ) * p.width;
  const margin = letterSize / ( options.sketch.layout?.marginDivisor ?? 1.5 );

  const from = p.createVector(
    0,
    -H + margin,
    0
  );
  const to = p.createVector(
    0,
    H - margin,
    0
  );

  const qualityLine = mappers.fn(
    p.sin( time / 2 ),
    -1,
    1,
    -0.05,
    1.05,
    easing.easeInOutQuad
  );

  const y = p.map(
    qualityLine,
    -0.05,
    1.05,
    -H,
    H
  );

  p.stroke( favoriteColor );
  p.strokeWeight( options.sketch.qualityLine?.weight ?? 2 );
  p.line(
    -W,
    y,
    W,
    y
  );

  if ( options.sketch.grid?.show ) {
    p.push();
    p.translate(
      -W,
      -H
    );
    drawGrid( {
      xCount: options.sketch.grid?.columns ?? 1,
      yCount: options.sketch.grid?.rows ?? 10,
      color: favoriteColor,
      weight: options.sketch.grid?.weight ?? 0.5
    } );
    p.pop();
  }

  p.translate(
    0,
    0,
    1
  );

  const steps = options.sketch.traced?.steps ?? 20;
  const sampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.1;

  const zValues = options.sketch.wave?.zValues ?? [
    -50,
    20,
    -100,
    50,
    20,
    100
  ];

  const start = [];
  const end = [];

  const letterValues = traceLetters.points( {
    texts: words,
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
      easingFn: easing.easeInOutCubic,
      currentTime: p.map(
        progression,
        0,
        1,
        0,
        Math.max(
          0,
          words.length - 1
        )
      )
    } ),
    () => p.beginShape(),
    (
      vector, vectorsListProgression, vectorIndexProgression
    ) => {
      const position = mappers.lerpVector(
        from,
        to,
        vectorsListProgression
      );

      const z = animation.ease( {
        values: zValues,
        duration: 1,
        easingFn: easing.easeInOutSine,
        currentTime: time / 2 + vectorsListProgression * 2
      } );

      position.add( vector );
      position.add(
        z,
        0
      );

      if ( vectorsListProgression === 1 ) {
        end.push( position.copy() );
      }

      if ( vectorsListProgression === 0 ) {
        start.push( position.copy() );
      }

      p.vertex(
        position.x,
        position.y,
        position.z
      );
    },
    (
      vectorIndexProgression, chunkIndex = 1
    ) => {
      const colorFunction = qualityLine > chunkIndex ? colors.rainbow : colors.purple;

      p.stroke( colorFunction( {
        hueOffset: options.sketch.colors?.hueOffset ?? 0,
        hueIndex:
          mappers.fn(
            p.sin( vectorIndexProgression + time / 4 + chunkIndex / 4 ),
            -1,
            1,
            -p.PI / 2,
            p.PI / 2
          ) * ( options.sketch.colors?.hueIndexMultiplier ?? 16 ),
        opacityFactor: p.map(
          p.sin( time * 2 + chunkIndex * 7 * vectorIndexProgression ),
          -1,
          1,
          options.sketch.colors?.opacityMax ?? 4,
          options.sketch.colors?.opacityMin ?? 1.5
        )
      } ) );

      p.strokeWeight( options.sketch.traced?.weight ?? 3 );
      p.endShape();
    }
  );

  p.translate(
    0,
    0,
    3
  );
  p.stroke( favoriteColor );
  p.fill( favoriteColor );
  p.strokeWeight( options.sketch.extremes?.weight ?? 3 );
  drawShape(
    end,
    false,
    p.POINTS
  );
  drawShape(
    start,
    false,
    p.POINTS
  );

  renderTitle();
} );
