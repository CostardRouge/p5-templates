import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  getAlphabet, drawGrid, getFont, loopedTime
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
  const alphabet = getAlphabet( "abcdefghijklmnopqrstuvwxyz" );
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

  const HUDmargin = options.sketch.hud?.margin ?? 50;

  if ( options.sketch.hud?.show ) {
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
    p.textAlign( p.RIGHT );
    string.write(
      lastLetter ?? "",
      W - HUDmargin,
      H - HUDmargin,
      textStyle
    );
    p.pop();
  }

  if ( options.sketch.grid?.show ) {
    p.push();
    p.translate(
      -W,
      -H
    );
    drawGrid( {
      xCount: options.sketch.grid?.columns ?? 2,
      yCount: options.sketch.grid?.rows ?? 4,
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

  const steps = options.sketch.traced?.steps ?? alphabet.length;
  const zAmp = options.sketch.wave?.amplitude ?? 0.5;

  mappers.traceVectors(
    steps,
    ( progression ) => {
      const sampleFactor = mappers.fn(
        p.sin( time ),
        -1,
        1,
        options.sketch.textStyle?.sampleFactorMin ?? 0.025,
        options.sketch.textStyle?.sampleFactor ?? 0.1
      );

      return animation.ease( {
        values: alphabet.map( ( text ) => string.getTextPoints( {
          text,
          size: letterSize,
          position: center,
          sampleFactor,
          font
        } ) ),
        duration: 1,
        lerpFn: mappers.lerpPoints,
        easingFn: easing.easeInOutExpo,
        currentTime: p.map(
          progression,
          0,
          1,
          letterStartIndex,
          letterEndIndex
        )
      } );
    },
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
        values: [
          -H * zAmp,
          -H * zAmp,
          0,
          0,
          H * zAmp,
          H * zAmp
        ],
        duration: 1,
        easingFn: easing.easeInOutExpo,
        currentTime:
          time + vectorIndexProgression / 2 + vectorsListProgression
      } );

      position.add( vector );
      position.add(
        0,
        z
      );

      if ( vectorsListProgression === 0 || vectorsListProgression === 1 ) {
        p.strokeWeight( options.sketch.traced?.endpointWeight ?? 7 );
        p.point(
          position.x,
          position.y,
          position.z
        );
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

  renderTitle();
} );
