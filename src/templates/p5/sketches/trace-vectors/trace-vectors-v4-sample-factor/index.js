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
  const alphabet = getAlphabet( "123" );
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

  const sampleValues = options.sketch.sampleFactor?.values ?? [
    0.1,
    0.075,
    0.05,
    0.025,
    0.3
  ];

  const sampleFactor = animation.ease( {
    values: sampleValues,
    duration: 1,
    easingFn: easing.easeInOutExpo,
    currentTime: time
  } );

  const textSampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.2;
  const steps = options.sketch.traced?.steps ?? alphabet.length * 3;

  const letterValues = traceLetters.points( {
    texts: alphabet,
    size: letterSize,
    position: center,
    sampleFactor: textSampleFactor,
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
      vector, vectorsListProgression, vectorIndexProgression
    ) => {
      const position = mappers.lerpVector(
        from,
        to,
        vectorsListProgression
      );

      const zAmp = options.sketch.wave?.zAmplitude ?? 0.5;
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

      if ( options.sketch.wave?.applyZ ?? false ) {
        position.add(
          0,
          0,
          z
        );
      }

      if ( options.sketch.wave?.applyY ?? false ) {
        position.add(
          0,
          z
        );
      }

      if ( vectorsListProgression === 0 || vectorsListProgression === 1 ) {
        p.strokeWeight( options.sketch.traced?.endpointWeight ?? 3 );
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
        hueOffset: sampleFactor + ( options.sketch.colors?.hueOffset ?? 0 ),
        hueIndex: mappers.circularPolar(
          vectorIndexProgression,
          0,
          1,
          -p.PI / 2,
          p.PI / 2
        ) * ( options.sketch.colors?.hueIndexMultiplier ?? 8 ),
        opacityFactor: options.sketch.colors?.opacityMin ?? 1.5
      } ) );

      p.strokeWeight( options.sketch.traced?.weight ?? 2 );
      p.endShape();
    }
  );

  renderTitle();
} );
