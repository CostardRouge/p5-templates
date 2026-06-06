import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";
import traceLetters from "@/p5/utils/traceLetters.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  getAlphabet, drawGrid, getFont, loopedTime, drawShape
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
  const alphabet = getAlphabet( "0123456789" );
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

  const letterRange = options.sketch.hud?.letterRange ?? 2;
  const indexValues = Array( Math.max(
    1,
    alphabet.length - letterRange
  ) )
    .fill( 0 )
    .map( (
      _, index
    ) => index );

  const letterStartIndex = animation.ease( {
    values: indexValues,
    duration: 1,
    currentTime: time / 2,
    easingFn: easing.easeInOutSine
  } );

  const letterEndIndex = animation.ease( {
    values: indexValues.map( ( idx ) => idx + letterRange ),
    duration: 1,
    currentTime: time / 2,
    easingFn: easing.easeInOutSine
  } );

  const firstLetter = alphabet[ Math.round( letterStartIndex ) % alphabet.length ];
  const lastLetter = alphabet[ Math.round( letterEndIndex ) % alphabet.length ];
  const middleLetter = alphabet[ Math.round( letterStartIndex + 1 ) % alphabet.length ];

  const HUDmargin = options.sketch.hud?.margin ?? 50;

  {
    p.push();
    const textStyle = {
      size: options.sketch.hud?.letterSize ?? 36,
      fill: p.color(
        128,
        128,
        255
      ),
      font
    };

    p.textAlign( p.LEFT );
    string.write(
      firstLetter ?? "",
      -W + HUDmargin,
      H - HUDmargin,
      textStyle
    );
    p.textAlign( p.CENTER );
    string.write(
      middleLetter ?? "",
      0,
      H - HUDmargin,
      textStyle
    );
    p.textAlign( p.RIGHT );
    string.write(
      lastLetter ?? "",
      W - HUDmargin,
      H - HUDmargin,
      textStyle
    );
    p.pop();
  }

  {
    p.push();
    p.translate(
      -W,
      -H
    );
    drawGrid( {
      xCount: options.sketch.grid?.columns ?? 5,
      yCount: options.sketch.grid?.rows ?? 4,
      color: favoriteColor,
      weight: options.sketch.grid?.weight ?? 0.5,
      skipX: options.sketch.grid?.skipX ?? [
        1,
        2
      ],
      skipY: options.sketch.grid?.skipY ?? []
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

  const steps = options.sketch.traced?.steps ?? 23;
  const sampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.4;

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
      easingFn: easing.easeInOutQuad,
      currentTime: p.map(
        progression,
        0,
        1,
        letterStartIndex,
        letterEndIndex
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

      p.vertex(
        position.x,
        position.y,
        position.z
      );
    },
    (
      vectorIndexProgression, chunkIndex = 1
    ) => {
      p.stroke( colors.test( {
        hueOffset: time + ( options.sketch.colors?.hueOffset ?? 0 ),
        hueIndex:
          mappers.fn(
            p.noise(
              letterStartIndex / 9,
              letterEndIndex / 9,
              chunkIndex / 2 + vectorIndexProgression * 2
            ),
            0,
            1,
            -p.PI / 2,
            p.PI / 2
          ) * ( options.sketch.colors?.hueIndexMultiplier ?? 8 ),
        opacityFactor: mappers.fn(
          p.noise(
            chunkIndex * 2 + time,
            vectorIndexProgression * 2
          ),
          0,
          1,
          options.sketch.colors?.opacityMax ?? 4,
          options.sketch.colors?.opacityMin ?? 1.5
        )
      } ) );

      p.strokeWeight( options.sketch.traced?.weight ?? 4 );
      p.endShape();
    }
  );

  p.translate(
    0,
    0,
    1
  );
  p.stroke( favoriteColor );
  p.strokeWeight( options.sketch.extremes?.weight ?? 3 );

  drawShape(
    start,
    false,
    p.POINTS
  );
  drawShape(
    end,
    false,
    p.POINTS
  );
  drawShape(
    middle,
    false,
    p.POINTS
  );

  renderTitle();
} );
