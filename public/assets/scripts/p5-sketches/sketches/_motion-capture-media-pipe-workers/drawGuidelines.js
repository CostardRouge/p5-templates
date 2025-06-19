import {
  mappers, animation, events, colors, grid, easing, string
} from "/assets/scripts/p5-sketches/utils/index.js";

import drawHands from "./drawHands.js";

let mask = undefined;
let hands = undefined;

events.register(
  "engine-window-preload",
  () => {
    hands = loadJSON( "/assets/scripts/p5-sketches/sketches/_motion-capture-media-pipe-workers/hands.json" );
  }
);

export default function drawGuidelines(
  text, {
    graphics, background: backgroundColor
  },
) {
  if ( !mask ) {
    mask = createGraphics(
      width,
      height,
    );

    // hands = Object.values( hands );
  }

  if ( backgroundColor ) {
    graphics.background( ...backgroundColor );
  }

  mask.clear();

  string.write(
    text,
    0,
    height / 2,
    {
      size: 144,
      font: string.fonts?.martian,
      textWidth: width,
      textAlign: [
        CENTER,
        CENTER
      ],
      popPush: false,
      graphics: mask
    }
  );

  const W = width / 2;

  const weight = 50;
  const rows = weight * 4;
  const columns = ( W / weight );
  const gridOptions = {
    topLeft: createVector(
      width * 0.3,
      height * 0.2
    ),
    topRight: createVector(
      width * 0.7,
      height * 0.2
    ),
    bottomLeft: createVector(
      width * 0.3,
      height * 0.8
    ),
    bottomRight: createVector(
      width * 0.7,
      height * 0.8
    ),
    rows,
    columns,
  };

  noiseDetail(
    3,
    .7,
  );

  grid.draw(
    gridOptions,
    (
      cellVector, {
        x, y
      }
    ) => {
      const xOff = x / width * 1.5;
      const yOff = y / height * 1.5;
      const angle = mappers.fn(
        noise(
          xOff + animation.circularProgression,
          yOff + animation.circularProgression
        ),
        0,
        1,
        -TAU,
        TAU,
        easing.easeInOutSine
      );

      const colorFunction = mappers.circularIndex(
        0,
        [
          colors.rainbow,
          colors.purple
        ]
      );

      graphics.stroke( colorFunction( {
        hueOffset: 0,
        hueIndex: angle,
        // opacityFactor: map(sin(animation.progression+xOff+yOff), -1, 1, 2.5, 1),
        opacityFactor: mappers.fn(
          noise(
            xOff,
            yOff,
            animation.circularProgression
          ),
          0,
          1,
          2,
          1,
          easing.easeInOutSine
        )
      } ) );

      graphics.push();
      graphics.translate(
        cellVector.x,
        cellVector.y
      );

      graphics.strokeWeight( weight );
      // graphics.point(
      //   sin( angle * 4 ),
      //   cos( angle * 9 + y )
      // );
      graphics.point(
        0,
        0
      );

      graphics.pop();
    }
  );

  const maskedImage = graphics.get();

  maskedImage.mask( mask );

  graphics.erase();
  graphics.noStroke();
  graphics.fill(
    0,
    0,
    0,
    255
  );
  graphics.rect(
    0,
    0,
    width,
    height
  );
  graphics.noErase();

  graphics.image(
    maskedImage,
    0,
    0
  );

  for ( const handKey in hands ) {
    const hand = hands[ handKey ];

    push();
    translate(
      0,
      map(
        animation.circularProgression,
        0,
        1,
        -500,
        50
      )
    );
    drawHands(
      {
        landmarks: [
          hand
        ]
      },
      graphics
    );
    pop();
  }
}
