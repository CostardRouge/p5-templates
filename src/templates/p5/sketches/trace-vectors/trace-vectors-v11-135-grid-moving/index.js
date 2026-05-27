import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import cache from "@/p5/utils/cache.js";
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

let gt = 0;

sketch.draw( (
  _t, center, favoriteColor
) => {
  const p = getP5();

  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );
  p.noFill();

  const time = loopedTime();
  const alphabet = getAlphabet( "123456789" );
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

  const cacheKey = `v11-cases-${ columns }x${ rows }-${ p.width }x${ p.height }`;

  const cases = cache.store(
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

  if ( options.sketch.grid?.showCellLabels ) {
    p.push();
    cases.forEach( (
      {
        x, y
      }, index
    ) => {
      string.write(
        String( index + 1 ),
        x,
        y,
        {
          center: true,
          size: options.sketch.grid?.cellLabelSize ?? 14,
          stroke: 255,
          fill: favoriteColor,
          font
        }
      );
    } );
    p.pop();
  }

  const cellIndexes = options.sketch.path?.cellIndexes ?? [
    1,
    5,
    7,
    3
  ];

  const positions = cellIndexes
    .map( ( index ) => cases[ index ] )
    .filter( Boolean );

  p.translate(
    0,
    0,
    1
  );

  const start = [];
  const end = [];
  const middle = [];

  const steps = options.sketch.traced?.steps ?? 5;
  const sampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.5;
  const pathDomain = options.sketch.path?.domain ?? cellIndexes.length;

  gt += mappers.circularIndex(
    time,
    options.sketch.path?.speedValues ?? [
      0,
      0,
      0.0075,
      0.015
    ]
  );

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
      easingFn: easing.easeInOutQuad,
      currentTime: p.map(
        progression,
        0,
        1,
        0,
        pathDomain
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
        easingFn: easing.easeInOutCubic,
        currentTime: time + gt + vectorsListProgression * 2
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
      p.stroke( colors.rainbow( {
        hueOffset: time + ( options.sketch.colors?.hueOffset ?? 0 ),
        hueIndex:
          mappers.fn(
            p.noise(
              chunkIndex,
              vectorIndexProgression * 3
            ),
            0,
            1,
            -p.PI / 2,
            p.PI / 2
          ) * ( options.sketch.colors?.hueIndexMultiplier ?? 16 ),
        opacityFactor: mappers.fn(
          p.noise(
            chunkIndex,
            vectorIndexProgression * 2
          ),
          0,
          1,
          options.sketch.colors?.opacityMax ?? 4,
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
  p.strokeWeight( options.sketch.extremes?.weight ?? 2 );

  drawShape(
    end,
    false,
    p.POINTS
  );
  drawShape(
    start,
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
