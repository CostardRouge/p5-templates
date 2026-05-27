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
  const alphabet = getAlphabet( "xyz" );
  const font = getFont( options.sketch.textStyle?.font );

  const W = p.width / 2;
  const H = p.height / 2;
  const letterSize = ( options.sketch.textStyle?.size ?? 0.66 ) * p.width;
  const margin = letterSize / 2;

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

  if ( options.sketch.grid?.show ) {
    p.push();
    p.translate(
      -W,
      -H
    );
    drawGrid( {
      xCount: options.sketch.grid?.columns ?? 3,
      yCount: options.sketch.grid?.rows ?? 3,
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

  const steps = options.sketch.traced?.steps ?? 23;
  const sampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.5;
  const swayAmp = options.sketch.sway?.amplitude ?? W / 1.5;
  const chunkCount = options.sketch.chunks?.count ?? 10;

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
      duration: 1 + progression / 5,
      lerpFn: mappers.lerpPoints,
      easingFn: easing.easeInOutCubic,
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
      vector, vectorsListProgression, vectorIndexProgression
    ) => {
      const position = mappers.lerpVector(
        from,
        to,
        vectorsListProgression
      );

      position.add( vector );

      const sway = animation.ease( {
        values: [
          -swayAmp,
          -swayAmp,
          0,
          0,
          swayAmp,
          swayAmp
        ],
        duration: 1,
        easingFn: easing.easeInOutExpo,
        currentTime:
          time +
          vectorIndexProgression * 3 +
          vectorsListProgression +
          vectorsListProgression
      } );

      position.add(
        sway,
        0
      );

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
      p.stroke( colors.test( {
        hueOffset: time + ( options.sketch.colors?.hueOffset ?? 0 ),
        hueIndex:
          mappers.fn(
            p.noise(
              chunkIndex,
              vectorIndexProgression * 2
            ),
            0,
            1,
            -p.PI / 2,
            p.PI / 2
          ) * ( options.sketch.colors?.hueIndexMultiplier ?? 8 ),
        opacityFactor: mappers.fn(
          p.noise(
            chunkIndex * 20,
            vectorIndexProgression * 2
          ),
          0,
          1,
          options.sketch.colors?.opacityMax ?? 5,
          options.sketch.colors?.opacityMin ?? 1.5
        )
      } ) );

      p.strokeWeight( options.sketch.traced?.weight ?? 10 );
      p.endShape();
    },
    false,
    false,
    chunkCount
  );

  p.translate(
    0,
    0,
    1
  );
  p.stroke( favoriteColor );
  p.fill(
    128,
    128,
    255,
    32
  );
  p.strokeWeight( options.sketch.extremes?.weight ?? 4 );

  drawShape(
    end,
    true
  );
  drawShape(
    start,
    true
  );
  drawShape(
    middle,
    true
  );

  renderTitle();
} );
