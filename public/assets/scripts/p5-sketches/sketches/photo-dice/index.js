import {
  sketch, animation, easing, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils
} from "/assets/scripts/p5-sketches/utils/index.js";

const canvases = {
};

sketch.setup(
  () => {
    canvases.dice = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
      WEBGL
    );

    background( ...options.colors.background );
    options.noSmooth && noSmooth();
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

function dice(
  size = width, render
) {
  const rotations = [
    canvases.dice.createVector(), // face
    canvases.dice.createVector(
      0,
      HALF_PI
    ), // right
    canvases.dice.createVector( HALF_PI ), // up
    canvases.dice.createVector(
      0,
      -HALF_PI
    ), // left
    canvases.dice.createVector(
      0,
      PI
    ), // back
    canvases.dice.createVector( -HALF_PI ), // bot
  ];

  for ( let i = 0; i < rotations.length; i++ ) {
    const {
      x: rX,
      y: rY,
      // z: rZ
    } = rotations[ i ];

    canvases.dice.push();
    canvases.dice.rotateX( rX );
    canvases.dice.rotateY( rY );
    // canvases.dice.rotateZ(rZ)
    canvases.dice.translate(
      0,
      0,
      size / 2
    );

    render(
      i,
      size
    );

    canvases.dice.pop();
  }
}

sketch.draw( (
  time, center, favoriteColor
) => {
  background( ...options.colors.background );

  const images = cache.get( "images" );

  const {
    x: rX,
    y: rY,
    // z: rZ
  } = animation.ease( {
    values: [
      canvases.dice.createVector(), // face
      canvases.dice.createVector(
        0,
        -HALF_PI
      ), // right
      canvases.dice.createVector( -HALF_PI ), // up
      canvases.dice.createVector(
        0,
        HALF_PI
      ), // left
      canvases.dice.createVector(
        0,
        PI
      ), // back
      canvases.dice.createVector( HALF_PI ), // bot
    ],
    currentTime: animation.progression * images.length,
    lerpFn: p5.Vector.lerp,
    easingFn: easing.easeInOutExpo,
    // easingFn: easing.easeInOutElastic,
    // easingFn: easing.easeInOutCirc,
  } );

  canvases.dice.push();

  canvases.dice.background( ...options.colors.background );
  canvases.dice.orbitControl();

  canvases.dice.rotateX( rX );
  canvases.dice.rotateY( rY );

  dice(
    width / 1.5,
    (
      index, size
    ) => {
      imageUtils.marginImage( {
        position: createVector(
          0,
          0
        ),
        img: images[ index ].img,
        scale: 0.65,
        center: true,
        graphics: canvases.dice,
      } );
    }
  );

  canvases.dice.pop();

  image(
    canvases.dice,
    0,
    0
  );

  const defaultTitle = "photo-dice".toUpperCase().replaceAll(
    "-",
    "\n"
  );

  if ( animation.progression < 0.2 ) {
    string.write(
      defaultTitle,
      // options.texts.title || defaultTitle,
      0,
      height / 2,
      {
        size: 128,
        stroke: color( ...options.colors.text ),
        fill: color( ...options.colors.background ),
        font: string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: EXCLUSION,
        graphics: canvases.foreground
      }
    );
  }
} );
