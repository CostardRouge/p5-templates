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
  getAlphabet, drawGrid, drawShape, getFont, loopedTime
} from "../_shared.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

const square = ( t ) => ( ( t % 1 ) < 0.5 ? 1 : 0 );

function easeOscillation(
  x, amplitude, fns
) {
  return fns.map( ( fn ) => animation.ease( {
    values: [
      -amplitude,
      amplitude
    ],
    duration: 1,
    easingFn: fn,
    currentTime: x
  } ) );
}

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

  const letterRange = options.sketch.hud?.letterRange ?? 1;

  const indexValues = Array( Math.max(
    1,
    alphabet.length - letterRange
  ) )
    .fill( 0 )
    .map( (
      _, index
    ) => index );

  const lettersSpeed = options.sketch.letters?.speed ?? 1;
  // loop-safe: slide the letter window through the whole alphabet once
  // (× speed) per loop and return exactly to the start at the seam
  const letterTime = traceLetters.sweep(
    animation.progression,
    indexValues.length,
    lettersSpeed
  );

  const letterStartIndex = animation.ease( {
    values: indexValues,
    duration: 1,
    currentTime: letterTime,
    easingFn: easing.easeInOutExpo
  } );

  const letterEndIndex = animation.ease( {
    values: indexValues.map( ( idx ) => idx + letterRange ),
    duration: 1,
    currentTime: letterTime,
    easingFn: easing.easeInOutExpo
  } );

  const firstLetter = alphabet[ Math.round( letterStartIndex ) % alphabet.length ];
  const lastLetter = alphabet[ Math.round( letterEndIndex ) % alphabet.length ];

  const HUDmargin = options.sketch.hud?.margin ?? 50;

  if ( options.sketch.hud?.showWaveform ) {
    p.strokeWeight( options.sketch.hud?.waveformWeight ?? 4 );
    p.stroke( favoriteColor );

    const topLeft = p.createVector(
      -W + HUDmargin,
      -H + HUDmargin
    );
    const topRight = p.createVector(
      W - HUDmargin,
      -H + HUDmargin
    );

    p.beginShape();

    const steps = options.sketch.hud?.waveformSteps ?? 150;
    const fns = [
      easing.easeInOutExpo,
      square,
      easing.easeInOutSine,
      square,
      undefined
    ];

    for ( let i = 0; i < steps; i++ ) {
      const progression = i / ( steps - 1 );
      const position = mappers.lerpVector(
        topLeft,
        topRight,
        progression
      );

      const h = animation.ease( {
        values: easeOscillation(
          time + progression * 4,
          HUDmargin,
          fns
        ),
        duration: 1,
        easingFn: easing.easeInOutElastic,
        currentTime: time
      } );

      position.add(
        0,
        h + HUDmargin
      );

      p.vertex(
        position.x,
        position.y
      );
    }
    p.endShape();
  }

  if ( options.sketch.hud?.showLetters ) {
    p.push();
    p.textAlign( p.LEFT );
    string.write(
      firstLetter ?? "",
      -W + HUDmargin,
      H - HUDmargin,
      {
        size: options.sketch.hud?.letterSize ?? 36,
        fill: p.color(
          128,
          128,
          255
        ),
        font
      }
    );

    p.textAlign( p.RIGHT );
    string.write(
      lastLetter ?? "",
      W - HUDmargin,
      H - HUDmargin,
      {
        size: options.sketch.hud?.letterSize ?? 36,
        fill: p.color(
          128,
          128,
          255
        ),
        font
      }
    );
    p.pop();
  }

  if ( options.sketch.grid?.show ) {
    p.push();
    p.translate(
      -W,
      -H
    );
    const dynamicColumns = Number( firstLetter );
    const dynamicRows = Number( lastLetter );

    drawGrid( {
      xCount: options.sketch.grid?.columns ?? ( Number.isFinite( dynamicColumns ) ? dynamicColumns : 20 ),
      yCount: options.sketch.grid?.rows ?? ( Number.isFinite( dynamicRows ) ? dynamicRows : 26 ),
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

  const steps = options.sketch.traced?.steps ?? alphabet.length * 6;
  const sampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.1;

  const start = [];
  const end = [];

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
      easingFn: easing.easeInOutCubic,
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
      vector, vectorsListProgression, vectorIndexProgression
    ) => {
      const position = mappers.lerpVector(
        from,
        to,
        vectorsListProgression
      );

      const z = animation.ease( {
        values: easeOscillation(
          vectorsListProgression * 3,
          H / ( options.sketch.wave?.amplitudeDivisor ?? 5 ),
          [
            easing.easeInOutExpo,
            square,
            easing.easeInOutSine,
            square,
            undefined
          ]
        ),
        duration: 1,
        easingFn: easing.easeInOutExpo,
        currentTime: time
      } );

      position.add( vector );
      position.add(
        0,
        z
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
    ( vectorIndexProgression ) => {
      p.stroke( colors.rainbow( {
        hueOffset: time + ( options.sketch.colors?.hueOffset ?? 0 ),
        hueIndex:
          mappers.fn(
            p.noise(
              letterStartIndex / 9,
              letterEndIndex / 9,
              vectorIndexProgression * 4
            ),
            0,
            1,
            -p.PI / 2,
            p.PI / 2
          ) * ( options.sketch.colors?.hueIndexMultiplier ?? 6 ),
        opacityFactor: p.map(
          p.sin( time * 2 + vectorIndexProgression * 8 ),
          -1,
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
  p.strokeWeight( options.sketch.extremes?.weight ?? 8 );
  drawShape( end );
  drawShape( start );

  renderTitle();
} );
