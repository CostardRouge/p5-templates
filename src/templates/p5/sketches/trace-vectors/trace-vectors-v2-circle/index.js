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
  const alphabet = getAlphabet( "0123456789" );
  const font = getFont( options.sketch.textStyle?.font );

  const W = p.width / 2;
  const H = p.height / 2;
  const letterSize = ( options.sketch.textStyle?.size ?? 0.66 ) * p.width;
  const radius = options.sketch.circle?.radius ?? 150;
  const scale = options.sketch.circle?.scale ?? 1.5;

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

  const steps = options.sketch.traced?.steps ?? alphabet.length * 2;
  const sampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.1;

  const start = [];
  const end = [];

  mappers.traceVectors(
    steps,
    ( progression ) => animation.ease( {
      values: alphabet.map( ( text ) => string.getTextPoints( {
        text,
        size: letterSize,
        position: center,
        sampleFactor,
        font
      } ) ),
      duration: 1,
      lerpFn: mappers.lerpPoints,
      easingFn: easing.easeInOutQuart,
      currentTime: p.map(
        progression,
        0,
        1,
        0,
        ( alphabet.length - 1 ) / alphabet.length
      )
    } ),
    () => p.beginShape(),
    (
      vector, vectorsListProgression
    ) => {
      const angle = mappers.fn(
        vectorsListProgression,
        0,
        1,
        0,
        p.TAU
      );
      const position = p.createVector(
        p.sin( angle ) * radius,
        p.cos( angle ) * radius
      );

      position.add(
        vector.x,
        vector.y
      );
      position.mult( scale );

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
              vectorIndexProgression * 8,
              vectorIndexProgression * p.cos( time + vectorIndexProgression )
            ),
            0,
            1,
            -p.PI / 2,
            p.PI / 2
          ) * ( options.sketch.colors?.hueIndexMultiplier ?? 6 ),
        opacityFactor: p.map(
          p.sin( time + vectorIndexProgression * 16 ),
          -1,
          1,
          options.sketch.colors?.opacityMax ?? 5,
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
