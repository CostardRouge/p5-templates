import events from "@/p5/utils/events.js";
import grid from "@/p5/utils/grid.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import colors from "@/p5/utils/colors.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

import drawHands from "@/p5/utils/mediapipe/drawHands.js";

let mask = undefined;
let hands = undefined;

events.register(
  "engine-window-preload",
  () => {
    hands = getP5().loadJSON( "/assets/scripts/p5-sketches/sketches/_motion-capture-media-pipe-workers/hands.json" );
  }
);

export default function drawGuidelines(
  text,
  {
    graphics, background: backgroundColor
  }
) {
  if ( !mask ) {
    mask = p.createGraphics(
      p.width,
      p.height
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
    p.height / 2,
    {
      size: 144,
      font: string.fonts?.martian,
      textWidth: p.width,
      textAlign: [
        p.CENTER,
        p.CENTER
      ],
      popPush: false,
      graphics: mask,
    }
  );

  const W = p.width / 2;

  const weight = 50;
  const rows = weight * 4;
  const columns = W / weight;
  const gridOptions = {
    topLeft: p.createVector(
      p.width * 0.3,
      p.height * 0.2
    ),
    topRight: p.createVector(
      p.width * 0.7,
      p.height * 0.2
    ),
    bottomLeft: p.createVector(
      p.width * 0.3,
      p.height * 0.8
    ),
    bottomRight: p.createVector(
      p.width * 0.7,
      p.height * 0.8
    ),
    rows,
    columns,
  };

  p.noiseDetail(
    3,
    0.7
  );

  grid.draw(
    gridOptions,
    (
      cellVector, {
        x, y
      }
    ) => {
      const xOff = ( x / p.width ) * 1.5;
      const yOff = ( y / p.height ) * 1.5;
      const angle = mappers.fn(
        p.noise(
          xOff + animation.circularProgression,
          yOff + animation.circularProgression
        ),
        0,
        1,
        -p.TAU,
        p.TAU,
        easing.easeInOutSine
      );

      const colorFunction = mappers.circularIndex(
        0,
        [
          colors.rainbow,
          colors.purple,
        ]
      );

      graphics.stroke( colorFunction( {
        hueOffset: 0,
        hueIndex: angle,
        // opacityFactor: p.map(p.sin(animation.progression+xOff+yOff), -1, 1, 2.5, 1),
        opacityFactor: mappers.fn(
          p.noise(
            xOff,
            yOff,
            animation.circularProgression
          ),
          0,
          1,
          2,
          1,
          easing.easeInOutSine
        ),
      } ) );

      graphics.push();
      graphics.translate(
        cellVector.x,
        cellVector.y
      );

      graphics.strokeWeight( weight );
      // graphics.point(
      //   p.sin( angle * 4 ),
      //   p.cos( angle * 9 + y )
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
    p.width,
    p.height
  );
  graphics.noErase();

  graphics.image(
    maskedImage,
    0,
    0
  );

  for ( const handKey in hands ) {
    const hand = hands[ handKey ];

    p.push();
    p.translate(
      0,
      p.map(
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
        ],
      },
      graphics
    );
    p.pop();
  }
}
