import {
  mappers, animation, colors, grid, easing, string, captureOptions as options, shapes, events
} from "/assets/scripts/p5-sketches/utils/index.js";

let mask = undefined;
let handImage = undefined;

events.register(
  "engine-window-preload",
  () => {
    handImage = loadImage( "./hand.svg" );
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
      size: 128,
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

  const weight = 30;
  const rows = weight * 4;
  const columns = ( width / weight );
  const gridOptions = {
    topLeft: createVector(
      0,
      0
    ),
    topRight: createVector(
      width,
      0
    ),
    bottomLeft: createVector(
      0,
      height
    ),
    bottomRight: createVector(
      width,
      height
    ),
    rows,
    columns,
    // centered: true
  };

  noiseDetail(
    8,
    0.45,
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
        hueIndex: angle, // map(angle, -10, 10, -PI, TAU),
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
}
