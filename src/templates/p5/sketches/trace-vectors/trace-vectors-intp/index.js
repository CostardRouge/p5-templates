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
  const alphabet = getAlphabet( "intp" );
  const font = getFont( options.sketch.textStyle?.font );

  const W = p.width / 2;
  const letterSize = ( options.sketch.textStyle?.size ?? 0.52 ) * p.width;
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
      xCount: options.sketch.grid?.columns ?? 4,
      yCount: options.sketch.grid?.rows ?? 2,
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
    0.15
  ];

  const steps = options.sketch.traced?.steps ?? alphabet.length * 6;

  let sampleFactor;

  const letterValues = traceLetters.points( {
    texts: alphabet,
    size: letterSize,
    position: center,
    sampleFactor: options.sketch.textStyle?.sampleFactor ?? 0.1,
    font
  } );

  mappers.traceVectors(
    steps,
    ( progression ) => {
      // keep updating the outer sampleFactor — onColor reads it for the hue
      sampleFactor = animation.ease( {
        values: sampleValues,
        duration: 1,
        easingFn: easing.easeInOutExpo,
        currentTime: time
      } );

      return traceLetters.morph( {
        values: letterValues,
        duration: 1,
        easingFn: easing.easeInOutExpo,
        currentTime: mappers.fn(
          progression,
          0,
          1,
          0,
          alphabet.length - 1,
          easing.easeInOutCirc
        )
      } );
    },
    () => {
      p.push();
      p.beginShape();
    },
    (
      vector, vectorsListProgression
    ) => {
      const position = mappers.lerpVector(
        from,
        to,
        vectorsListProgression
      );

      position.add( vector );

      p.vertex(
        position.x,
        position.y,
        position.z
      );
    },
    (
      vectorIndexProgression, chunkIndex = 1
    ) => {
      p.stroke( colors.rainbow( {
        hueOffset: sampleFactor + ( options.sketch.colors?.hueOffset ?? 0 ),
        hueIndex:
          mappers.fn(
            p.noise(
              vectorIndexProgression * 4,
              chunkIndex
            ),
            0,
            1,
            -p.PI / 2,
            p.PI / 2
          ) * ( options.sketch.colors?.hueIndexMultiplier ?? 6 ),
        opacityFactor: options.sketch.colors?.opacityMin ?? 1.5
      } ) );

      p.strokeWeight( options.sketch.traced?.weight ?? 3 );
      p.endShape();
      p.pop();
    }
  );

  renderTitle();
} );
