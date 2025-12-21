import options from "@/p5/utils/options.js";

import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";

import shapes from "@/p5/utils/shapes.js";
import animation from "@/p5/utils/animation.js";

sketch.setup( () => {
  background( ...options.colors.background );
} );

function drawRectangle( {
  firstCornerPosition,
  oppositeCornerPosition,
  thickness = 1,
  strokeColor = 255,
  fillColor = color(
    0,
    0,
    0,
    0
  ),
  atCorner,
} ) {
  const width = abs( firstCornerPosition.x - oppositeCornerPosition.x );
  const height = abs( firstCornerPosition.y - oppositeCornerPosition.y );

  push();
  fill( fillColor );
  rectMode( CORNERS );
  stroke( strokeColor );
  strokeWeight( thickness );

  rect(
    firstCornerPosition.x,
    firstCornerPosition.y,
    oppositeCornerPosition.x,
    oppositeCornerPosition.y
  );

  if ( atCorner ) {
    [
      firstCornerPosition,
      createVector(
        firstCornerPosition.x + width,
        firstCornerPosition.y
      ),
      oppositeCornerPosition,
      createVector(
        firstCornerPosition.x,
        firstCornerPosition.y + height
      ),
    ].forEach( (
      cornerPosition, cornerIndex
    ) =>
      atCorner?.(
        cornerPosition,
        cornerIndex
      ) );
  }

  pop();
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
  ],
];

sketch.draw( (
  time, center, favoriteColor
) => {
  background( ...options.colors.background );

  const {
    x: rectangleWidth, y: rectangleHeight
  } = animation.ease( {
    values: [
      createVector(
        width * 0.3,
        height * 0.2
      ),
      createVector(
        width * 0.7,
        height * 0.4
      ),
      createVector(
        width * 0.3,
        height * 0.3
      ),
    ],
    currentTime: animation.progression * 3,
    easingFn: easing.easeInOutElastic,
    lerpFn: p5.Vector.lerp,
  } );

  const firstRectangleCornerPosition = createVector(
    center.x - rectangleWidth / 2,
    center.y - rectangleHeight / 2
  );

  const oppositeRectangleCornerPosition = createVector(
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

      line(
        cornerPosition.x + xShift * margin,
        cornerPosition.y,
        cornerPosition.x + xShift * length,
        cornerPosition.y
      );

      line(
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
        //     stroke: color( 255 ),
        //     strokeWeight: 0,
        //     fill: color( 255 ),
        //     font: string.fonts.martian,
        //     textAlign: [
        //       LEFT,
        //       CENTER
        //     ],
        //   }
        // );

        push();
        translate(
          cornerPosition.x - xShift * margin,
          cornerPosition.y + ( yShift * ( length / 2 ) + ( yShift * margin * 2 ) / 3 )
        );
        rotate( PI / 2 );
        string.write(
          String( Number( cornerPosition.x ) ),
          0,
          0,
          {
            size: margin * 2,
            stroke: color( 255 ),
            strokeWeight: 0,
            fill: color( 255 ),
            font: string.fonts.martian,
            textWidth: 0,
            textAlign: [
              CENTER,
              CENTER
            ],
          }
        );
        pop();
      }
    },
  } );

  shapes.vl( 1 );
  shapes.vl( width - 1 );
  shapes.hl( 1 );
  shapes.hl( height - 1 );

  // string.write(
  //   "top",
  //   width * .1,
  //   height * .2,
  //   {
  //     size: 92,
  //     stroke: color( ...options.colors.background ),
  //     fill: color(
  //       ...options.colors.text,
  //       190
  //     ),
  //     font: string.fonts.martian,
  //     textAlign: [
  //       LEFT
  //     ],
  //   }
  // );
} );
