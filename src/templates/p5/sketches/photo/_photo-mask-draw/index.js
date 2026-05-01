import cache from "@/p5/utils/cache.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const canvases = {
  mask: undefined,
};

function drawImageWithMask( {
  img, maskDrawer, graphics = getP5()
} ) {
  const eraseMode = 1; // animation.progression >= .5;

  if ( eraseMode ) {
    canvases.mask.erase();
  }

  maskDrawer?.(
    canvases.mask,
    eraseMode
  );

  if ( eraseMode ) {
    canvases.mask.enoEraserase();
  }

  const maskedImage = img.get();

  maskedImage.mask( canvases.mask );
  graphics.image(
    maskedImage,
    0,
    0,
    graphics.width,
    graphics.height
  );
}

sketch.setup( () => {
  const p = getP5();

  canvases.mask = p.createGraphics(
    p.width,
    p.height
  );

  // canvases.mask.pixelDensity(options.backgroundPixelDensity || 0.075);
  p.background( ...options.colors.background );

  canvases.mask.rect(
    0,
    0,
    p.width,
    p.height
  );

  // resetBallPositions();
} );

events.register(
  "engine-window-preload",
  () => {
    const p = getP5();

    cache.get( "images" ).forEach( ( image ) => {
      Object.assign(
        image,
        {
          ball: {
            position: p.createVector(),
            size: p.random(
              200,
              300,
              400
            ),
            vx: p.random(
              -1,
              1
            ),
            vy: p.random(
              -1,
              1
            ),
          },
        }
      );
    } );
  }
);

sketch.draw( (
  time, center, favoriteColor
) => {
  const p = getP5();

  p.background( ...options.colors.background );

  const imageObjects = cache.get( "images" );
  const ballsCount = 12;

  const m = mappers.fn(
    animation.circularProgression,
    0,
    1,
    0,
    50,
    easing.easeInOutExpo
  );
  const w = p.width / 2;
  const h = p.height / 2;
  const radius = mappers.fn(
    animation.circularProgression,
    0,
    1,
    10,
    w - m,
    easing.easeInOutExpo
  );
  const size = mappers.fn(
    animation.circularProgression,
    0,
    1,
    350,
    25,
    easing.easeInOutExpo
  );

  for ( let ballIndex = 0; ballIndex < ballsCount; ballIndex++ ) {
    const angleProgression = ballIndex / ballsCount;
    const angle = angleProgression * p.TAU;
    // const size = mappers.fn(animation.circularProgression, 0, 1, 250, 150, easing.easeInOutExpo);

    // const radiusPhase = mappers.fn(animation.triangleProgression(), 0, 1, 0, ballIndex, easing.easeInOutSine);
    // const radius = mappers.fn(p.sin(animation.angle+radiusPhase), -1, 1, 10, w-m, easing.easeInOutSine);
    // const size = mappers.fn(p.sin(animation.angle*2+angleProgression), -1, 1, 250, 150, easing.easeInOutSine);

    // const radius = mappers.fn(, -1, 1, 0, w, easing.easeInOutExpo)

    const ballPosition = p.createVector(
      p.sin( angle + animation.progression ) * radius,
      p.cos( angle + animation.progression ) * radius
    );

    ballPosition.add( center );

    drawImageWithMask( {
      img: imageObjects[ 0 ].img,
      maskDrawer: ( graphics ) => {
        graphics.fill( 255 );
        graphics.noStroke();
        graphics.circle(
          ballPosition.x,
          ballPosition.y,
          size
        );
      },
    } );
  }

  const defaultTitle = "photo-draw".toUpperCase().replaceAll(
    "-",
    "\n"
  );

  if ( animation.progression < 0.2 ) {
    string.write(
      defaultTitle,
      // options.texts.title || defaultTitle,
      p.width / 2,
      p.height / 2,
      {
        size: 128,
        stroke: p.color( ...options.colors.text ),
        fill: p.color( ...options.colors.background ),
        font: string.fonts.martian,
        textAlign: [
          p.CENTER,
          p.CENTER
        ],
        blendMode: EXCLUSION,
      }
    );
  }
} );
