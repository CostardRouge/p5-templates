import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import traceLetters from "@/p5/utils/traceLetters.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  getAlphabet, drawGrid, getFont, loopedPhase, drawShape
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

  const alphabet = getAlphabet( "123" );
  const font = getFont( options.sketch.textStyle?.font );

  const W = p.width / 2;
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
      -p.height / 2
    );
    drawGrid( {
      xCount: options.sketch.grid?.columns ?? 3,
      yCount: options.sketch.grid?.rows ?? 1,
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

  const start = [];
  const end = [];
  const middle = [];

  const steps = options.sketch.traced?.steps ?? alphabet.length * 9;
  const sampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.15;

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
      currentTime: p.map(
        progression,
        0,
        1,
        0,
        alphabet.length - 1
      )
    } ),
    () => p.beginShape(),
    (
      vector, vectorsListProgression
    ) => {
      const position = mappers.lerpVector(
        from,
        to,
        vectorsListProgression
      );

      position.add( vector );

      if ( vectorsListProgression === 1 ) {
        end.push( position );
      }
      if ( vectorsListProgression === 0 ) {
        start.push( position );
      }
      if ( vectorsListProgression === 0.5 ) {
        middle.push( position );
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
      const vectorOffset = vectorIndexProgression * 5;
      const chunkOffset = chunkIndex;

      p.stroke( colors.rainbow( {
        hueOffset: chunkOffset + ( options.sketch.colors?.hueOffset ?? 0 ),
        hueIndex: mappers.circularPolar(
          vectorIndexProgression,
          0,
          1,
          -p.PI / 2,
          p.PI / 2
        ) * ( options.sketch.colors?.hueIndexMultiplier ?? 8 ),
        // Loop-exact opacity oscillation — whole turns per loop.
        opacityFactor: mappers.fn(
          p.sin( loopedPhase(
            10,
            p.TAU
          ) + vectorOffset * 10 + chunkOffset * 10 ),
          -1,
          1,
          options.sketch.colors?.opacityMax ?? 5,
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
    1
  );
  p.stroke( favoriteColor );
  p.fill( favoriteColor );
  p.strokeWeight( options.sketch.extremes?.weight ?? 3 );

  drawShape(
    end,
    false,
    p.TRIANGLES
  );
  drawShape(
    start,
    false,
    p.TRIANGLES
  );
  drawShape(
    middle,
    false,
    p.TRIANGLES
  );

  renderTitle();
} );
