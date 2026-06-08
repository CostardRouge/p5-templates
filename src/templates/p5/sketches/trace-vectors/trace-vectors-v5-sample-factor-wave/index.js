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
  getAlphabet, getFont, loopedTime, drawShape
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
  const alphabet = getAlphabet( "123" );
  const font = getFont( options.sketch.textStyle?.font );

  const W = p.width / 2;
  const letterSize = ( options.sketch.textStyle?.size ?? 0.222 ) * p.width;
  const margin = ( options.sketch.layout?.marginPx ?? 200 ) + letterSize;

  const from = p.createVector(
    -W + margin,
    0
  );
  const to = p.createVector(
    W - margin,
    0
  );

  const start = [];
  const end = [];
  const middle = [];

  const sampleValues = options.sketch.sampleFactor?.values ?? [
    0.1,
    0.075,
    0.065,
    0.05,
    0.045,
    0.03,
    0.025
  ];

  const steps = options.sketch.traced?.steps ?? alphabet.length;

  mappers.traceVectors(
    steps,
    ( progression ) => {
      // sampleFactor is animated per step, so the clouds cannot be hoisted;
      // routing through traceLetters.points keeps them in the bounded memo
      // (pixel-identical, no unbounded cache growth).
      const sampleFactor = animation.ease( {
        values: sampleValues,
        duration: 1,
        easingFn: easing.easeInOutExpo,
        currentTime: progression / 2 + time
      } );

      return traceLetters.morph( {
        values: traceLetters.points( {
          texts: alphabet,
          size: letterSize,
          position: center,
          sampleFactor,
          font
        } ),
        duration: 1,
        currentTime: p.map(
          progression,
          0,
          1,
          0,
          alphabet.length - 1
        )
      } );
    },
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
    ( vectorIndexProgression ) => {
      p.stroke( colors.rainbow( {
        hueOffset: options.sketch.colors?.hueOffset ?? 0,
        hueIndex: mappers.circularPolar(
          vectorIndexProgression,
          0,
          1,
          -p.PI / 2,
          p.PI / 2
        ) * ( options.sketch.colors?.hueIndexMultiplier ?? 8 ),
        opacityFactor: options.sketch.colors?.opacityMin ?? 1.5
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
  p.strokeWeight( options.sketch.extremes?.weight ?? 3 );

  drawShape(
    end,
    false
  );
  drawShape(
    start,
    false
  );
  drawShape(
    middle,
    false
  );

  renderTitle();
} );
