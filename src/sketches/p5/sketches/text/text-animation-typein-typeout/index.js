import options from "@/p5/utils/options.js";

import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";

import shapes from "@/p5/utils/shapes.js";
import animation from "@/p5/utils/animation.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.colors.background );
} );

function drawRectangle( {
  firstCornerPosition,
  oppositeCornerPosition,
  thickness = 1,
  strokeColor = 255,
  fillColor = getP5().color(
    0,
    0,
    0,
    0
  ),
  atCorner
} ) {
  const p = getP5();
  const width = p.abs( firstCornerPosition.x - oppositeCornerPosition.x );
  const height = p.abs( firstCornerPosition.y - oppositeCornerPosition.y );

  p.push();
  p.fill( fillColor );
  p.rectMode( p.CORNERS );
  p.stroke( strokeColor );
  p.strokeWeight( thickness );

  p.rect(
    firstCornerPosition.x,
    firstCornerPosition.y,
    oppositeCornerPosition.x,
    oppositeCornerPosition.y
  );

  if ( atCorner ) {
    [
      firstCornerPosition,
      p.createVector(
        firstCornerPosition.x + p.width,
        firstCornerPosition.y
      ),
      oppositeCornerPosition,
      p.createVector(
        firstCornerPosition.x,
        firstCornerPosition.y + p.height
      )
    ].forEach( (
      cornerPosition, cornerIndex
    ) =>
      atCorner?.(
        cornerPosition,
        cornerIndex
      ) );
  }

  p.pop();
}

const cornerPositionCorrections = [
  [
    -1,
    -1
  ],
  [
    1,
    -1
  ],
  [
    1,
    1
  ],
  [
    -1,
    1
  ]
];

sketch.draw( (
  time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...options.colors.background );

  const {
    x: rectangleWidth, y: rectangleHeight
  } = animation.ease( {
    values: [
      p.createVector(
        p.width * 0.3,
        p.height * 0.2
      ),
      p.createVector(
        p.width * 0.7,
        p.height * 0.4
      ),
      p.createVector(
        p.width * 0.3,
        p.height * 0.3
      )
    ],
    currentTime: animation.progression * 3,
    easingFn: easing.easeInOutElastic,
    lerpFn: mappers.lerpVector
  } );

  const firstRectangleCornerPosition = p.createVector(
    center.x - rectangleWidth / 2,
    center.y - rectangleHeight / 2
  );

  const oppositeRectangleCornerPosition = p.createVector(
    center.x + rectangleWidth / 2,
    center.y + rectangleHeight / 2
  );

  drawRectangle( {
    position: center,
    firstCornerPosition: firstRectangleCornerPosition,
    oppositeCornerPosition: oppositeRectangleCornerPosition,
    thickness: 4,
    atCorner: (
      cornerPosition, cornerIndex
    ) => {
      const [
        xShift,
        yShift
      ] = cornerPositionCorrections[ cornerIndex ];

      const margin = 10;
      const length = 30;

      p.line(
        cornerPosition.x + xShift * margin,
        cornerPosition.y,
        cornerPosition.x + xShift * length,
        cornerPosition.y
      );

      p.line(
        cornerPosition.x,
        cornerPosition.y + yShift * margin,
        cornerPosition.x,
        cornerPosition.y + yShift * length
      );

      if ( cornerIndex === 0 ) {
        // string.write(
        //   String( Number( cornerPosition.x ) ),
        //   cornerPosition.x - ( xShift * margin ),
        //   cornerPosition.y + ( yShift * ( length / 2 ) + ( yShift * margin * 2 / 3 ) ),
        //   {
        //     size: margin * 2,
        //     stroke: p.color( 255 ),
        //     strokeWeight: 0,
        //     fill: p.color( 255 ),
        //     font: string.fonts.martian,
        //     textAlign: [
        //       p.LEFT,
        //       p.CENTER
        //     ],
        //   }
        // );

        p.push();
        p.translate(
          cornerPosition.x - xShift * margin,
          cornerPosition.y + ( yShift * ( length / 2 ) + ( yShift * margin * 2 ) / 3 )
        );
        p.rotate( p.PI / 2 );
        string.write(
          String( Number( cornerPosition.x ) ),
          0,
          0,
          {
            size: margin * 2,
            stroke: p.color( 255 ),
            strokeWeight: 0,
            fill: p.color( 255 ),
            font: string.fonts.martian,
            textWidth: 0,
            textAlign: [
              p.CENTER,
              p.CENTER
            ]
          }
        );
        p.pop();
      }
    }
  } );

  shapes.vl( 1 );
  shapes.vl( p.width - 1 );
  shapes.hl( 1 );
  shapes.hl( p.height - 1 );

  // string.write(
  //   "top",
  //   p.width * .1,
  //   p.height * .2,
  //   {
  //     size: 92,
  //     stroke: p.color( ...options.colors.background ),
  //     fill: p.color(
  //       ...options.colors.text,
  //       190
  //     ),
  //     font: string.fonts.martian,
  //     textAlign: [
  //       p.LEFT
  //     ],
  //   }
  // );
} );
