import options from "@/p5/utils/options.js";

import cache from "@/p5/utils/cache.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import scripts from "@/p5/utils/scripts.js";
import events from "@/p5/utils/events.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import * as common from "@/p5/utils/common.js";

import renderTitle from "@/p5/utils/title/renderTitle";

import Matter from "@/public/assets/libraries/matter.min.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

scripts.load( "/assets/libraries/decomp.min.js" );

// helpers
const getBg = () =>
  options.sketch?.backgroundColor ??
  options.colors?.background ?? [
    246,
    235,
    225
  ];

const getTextColor = () =>
  options.sketch?.textColor ?? options.colors?.text ?? [
    0
  ];

const getFont = () =>
  string.fonts?.[ options.sketch?.font ] || string.fonts.martian;

const getImages = () => {
  const imagesFromOptions =
    options.sketch?.images && options.sketch.images.length
      ? options.sketch.images
      : null;

  const fromCache = cache.get( "images" );

  return imagesFromOptions
    ? imagesFromOptions.map( ( p ) => common.getAsset( p ) ).filter( Boolean )
    : fromCache || [
    ];
};

const {
  Engine, Body, Bodies, Vector, Composite
} = Matter;

events.register(
  "engine-mouse-dragged",
  () => {
    const p = getP5();

    addImageBall(
      p.random( getImages() ).img,
      p.mouseX,
      p.mouseY,
      p.random(
      // 50,
      // 75,
        100,
        125,
        150
      // 200,
      // 250,
      // 300
      )
    );
  }
);

const canvases = {
  mask: undefined,
  imageBuffer: undefined,
};

const matter = {
  engine: Engine.create(),
  bottom: undefined,
  balls: [
  ],
  boundaries: [
  ],
};

function drawImageWithMask( {
  img, maskDrawer, graphics = getP5()
} ) {
  const p = graphics;

  // p.image(img, 0, 0, graphics.width, graphics.height);

  imageUtils.marginImage( {
    img,
    fill: true,
    center: true,
    graphics: canvases.imageBuffer,
    position: p.createVector(
      p.width / 2,
      p.height / 2
    ),
  } );

  // Clean mask
  canvases.mask.erase();
  canvases.mask.rect(
    0,
    0,
    graphics.width,
    graphics.height
  );
  canvases.mask.noErase();

  maskDrawer?.( canvases.mask );

  const maskedImage = canvases.imageBuffer.get();

  maskedImage.mask( canvases.mask );

  graphics.image(
    maskedImage,
    0,
    0,
    graphics.width,
    graphics.height
  );
}

function addImageBall(
  img, x, y, radius
) {
  // if (matter.balls.length > 20) {
  // 	const lastImageBall = matter.balls.pop();
  //
  // 	if (lastImageBall) {
  // 		Composite.remove(matter.engine.world, lastImageBall.ball);
  // 	}
  // }

  const newImageBall = {
    img,
    ball: Bodies.circle(
      x,
      y,
      radius,
      radius
    ),
  };

  // const velocityMagnitude = 5;
  //
  // Body.setVelocity(
  // 	newImageBall.ball,
  // 	Vector.create(
  // 		p.random(-velocityMagnitude),
  // 		p.random(velocityMagnitude)
  // 	)
  // )

  matter.balls.unshift( newImageBall );
  Composite.add(
    matter.engine.world,
    newImageBall.ball
  );
}

function addBoundary(
  x, y, w, h
) {
  const newBoundary = Bodies.rectangle(
    x,
    y,
    w,
    h,
    {
      isStatic: true,
    }
  );

  matter.boundaries.unshift( newBoundary );
  Composite.add(
    matter.engine.world,
    newBoundary
  );
}

sketch.setup( () => {
  const p = getP5();

  canvases.mask = p.createGraphics(
    p.width,
    p.height
  );
  canvases.imageBuffer = p.createGraphics(
    p.width,
    p.height
  );

  // canvases.mask.pixelDensity(options.backgroundPixelDensity || 0.5);
  p.background( ...getBg() );

  const margin = 50;
  const thickness = 50;

  addBoundary(
    p.width / 2,
    p.height + thickness / 2 - margin,
    p.width,
    thickness
  );
  addBoundary(
    p.width / 2,
    -thickness / 2 + margin,
    p.width,
    thickness
  );
  addBoundary(
    -thickness / 2 + margin,
    p.height / 2,
    thickness,
    p.height
  );
  addBoundary(
    p.width + thickness / 2 - margin,
    p.height / 2,
    thickness,
    p.height
  );

  const images = getImages();

  for ( let i = 0; i <= 10; i++ ) {
    addImageBall(
      images?.[ 0 ]?.img,
      p.random( p.width ),
      p.random( p.height ),
      p.width / 6 - 2 * margin
      // p.random(100)
    );
  }
} );

sketch.draw( (
  time, center, favoriteColor
) => {
  const p = getP5();

  p.background( ...getBg() );

  // if (p.frameCount === 1) {
  // 	for (let i = 0; i < 120; i++) {
  // 		Engine.update(matter.engine);
  // 	}
  // }

  Engine.update( matter.engine );

  matter.engine.gravity = Vector.create(
    // mappers.fn(animation.circularProgression, 0, 1, -1, 1, easing.easeInOutExpo),
    // mappers.fn(animation.circularProgression, 0, 1, -1, 1, easing.easeInOutExpo)
    mappers.fn(
      p.sin( animation.angle * 2 ),
      -1,
      1,
      -1,
      1,
      easing.easeInOutExpo
    ),
    mappers.fn(
      p.cos( animation.angle * 2 ),
      -1,
      1,
      -1,
      1,
      easing.easeInOutExpo
    )

    // animation.sinOscillation,
    // animation.cosOscillation
  );

  const links = [
  ];

  matter.balls.forEach( (
    {
      img, ball
    }, index
  ) => {
    const {
      position: {
        x, y
      },
      circleRadius,
    } = ball;

    matter.balls.forEach( (
      {
        img, ball
      }, _index
    ) => {
      if ( index == _index ) {
        return;
      }

      if ( links.includes( `${ _index }-${ index }` ) ) {
        return;
      }

      const {
        position: {
          x: _x, y: _y
        },
      } = ball;

      // p.stroke(0, 0, 0, p.map(position.dist(_position), 0, 1000, 0, 100));

      p.strokeWeight( 1 );
      p.line(
        x,
        y,
        _x,
        _y
      );
      links.push( `${ index }-${ _index }` );
    } );

    drawImageWithMask( {
      img,
      maskDrawer: ( graphics ) => {
        graphics.fill( 255 );
        graphics.noStroke();
        graphics.ellipse(
          x,
          y,
          circleRadius * 2,
          circleRadius * 2
        );
      },
    } );
  } );

  renderTitle();
} );
