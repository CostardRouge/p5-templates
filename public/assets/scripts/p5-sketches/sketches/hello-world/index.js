import {
  sketch, mappers, animation, string, captureOptions as options, shapes
} from "/assets/scripts/p5-sketches/utils/index.js";

let graphic = null;

sketch.setup(
  () => {
    graphic = createGraphics(
      options.size.width,
      options.size.height
    );

    background( ...options.colors.background );
    graphic.background( ...options.colors.background );
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    }
  }
);

sketch.draw( (
  time, center, favoriteColor
) => {
  // options.colors.text = [252, 209, 83]
  // blendMode(HARD_LIGHT);

  background( ...options.colors.background );

  const horizontalMargin = width * .1;

  string.write(
    options.texts.top || "top",
    horizontalMargin,
    height * .2,
    {
      size: 92,
      stroke: color( ...options.colors.background ),
      fill: color(
        ...options.colors.text,
        190
      ),
      font: string.fonts.martian,
      textAlign: [
        LEFT
      ],
    }
  );

  string.write(
    options.texts.bottom || "bottom",
    0,
    height * .8,
    {
      textAlign: [
        RIGHT
      ],
      size: 92,
      stroke: color( ...options.colors.background ),
      textWidth: width - horizontalMargin,
      fill: color(
        ...options.colors.text,
        190
      ),
      font: string.fonts.martian
    }
  );

  graphic.background(
    ...options.colors.background,
    120
  );

  graphic.fill( 0 );
  graphic.circle(
    mappers.fn(
      animation.circularProgression,
      0,
      1,
      100,
      width - 100
    ),
    mappers.fn(
      animation.circularProgression,
      1,
      0,
      100,
      height - 100
    ),
    90
  );

  const w = width / 2;
  const h = height / 2;
  const m = 100;

  graphic.push();
  graphic.translate(
    w,
    h
  );
  graphic.circle(
    mappers.fn(
      Math.sin( animation.sinAngle ),
      -1,
      1,
      -w + m,
      w - m
    ),
    mappers.fn(
      Math.cos( animation.cosAngle ),
      -1,
      1,
      -h + m,
      h - m
    ),
    90
  );
  graphic.pop();

  image(
    graphic,
    0,
    0,
    SCREEN
  );
  blend(
    graphic,
    0,
    0,
    width,
    height,
    0,
    0,
    width,
    height,
    EXCLUSION
  );

  if ( options.durationBar ) {
    shapes.sketchDurationBar( favoriteColor );
  }
} );
