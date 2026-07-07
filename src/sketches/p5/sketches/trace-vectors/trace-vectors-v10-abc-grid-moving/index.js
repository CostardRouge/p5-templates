import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import cache from "@/p5/utils/cache.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import traceLetters from "@/p5/utils/traceLetters.js";
import iterators from "@/p5/utils/iterators.js";

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

  p.clear();
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

  const columns = options.sketch.grid?.columns ?? 3;
  const rows = options.sketch.grid?.rows ?? 3;

  if ( options.sketch.grid?.show ) {
    p.push();
    p.translate(
      -W,
      -H
    );
    drawGrid( {
      xCount: columns,
      yCount: rows,
      color: favoriteColor,
      weight: options.sketch.grid?.weight ?? 0.5
    } );
    p.pop();
  }

  const cacheKey = `v10-positions-${ columns }x${ rows }-${ p.width }x${ p.height }`;

  const positions = cache.store(
    cacheKey,
    () => {
      const result = [];

      for ( let yy = 0; yy < rows; yy++ ) {
        const y = p.lerp(
          -H / ( rows / 2 ),
          H / ( rows / 2 ),
          yy / Math.max(
            1,
            rows - 1
          )
        );

        for ( let xx = 0; xx < columns; xx++ ) {
          const x = p.lerp(
            -W / ( columns / 2 ),
            W / ( columns / 2 ),
            xx / Math.max(
              1,
              columns - 1
            )
          );

          result.push( p.createVector(
            x,
            y
          ) );
        }
      }

      return result;
    }
  );

  {
    p.stroke( options.sketch.trajectory?.dotColor ?? 96 );
    p.strokeWeight( options.sketch.trajectory?.weight ?? 2 );

    p.beginShape();
    iterators.vectors(
      positions,
      ( {
        x, y
      } ) => p.point(
        x,
        y
      ),
      options.sketch.trajectory?.dotInterval ?? 0.05
    );
    p.endShape();
  }

  p.translate(
    0,
    0,
    1
  );

  const start = [];
  const end = [];
  const middle = [];

  const steps = options.sketch.traced?.steps ?? 3;
  const sampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.3;

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
        Math.min(
          2,
          alphabet.length - 1
        )
      )
    } ),
    () => p.beginShape(),
    (
      vector, vectorsListProgression
    ) => {
      const position = animation.ease( {
        values: positions,
        duration: 1,
        lerpFn: mappers.lerpVector,
        easingFn: easing.easeInOutExpo,
        currentTime: time + vectorsListProgression * 2
      } );

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
            chunkIndex,
            vectorIndexProgression * 2
          ),
          0,
          1,
          options.sketch.colors?.opacityMax ?? 5,
          options.sketch.colors?.opacityMin ?? 1.5
        )
      } ) );

      p.strokeWeight( options.sketch.traced?.weight ?? 5 );
      p.endShape();
    }
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
} );
