import {
  sketch, animation, easing, exif, mappers, string, events, scripts, captureOptions as options, cache, grid, colors, imageUtils
} from "/assets/scripts/p5-sketches/utils/index.js";

await scripts.load( "/assets/libraries/decomp.min.js" );
await scripts.load( "/assets/libraries/matter.min.js" );

const {
  Engine, Body, Bodies, Vector, Composite
} = Matter;

events.register(
  "engine-mouse-dragged",
  () => {
    addImageBall(
      random( cache.get( "images" ) ).img,
      mouseX,
      mouseY,
      random(
      // 50,
      // 75,
        100,
        125,
        150,
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
  ]
};

function drawImageWithMask( {
  img,
  maskDrawer,
  graphics = window
} ) {
  // image(img, 0, 0, graphics.width, graphics.height);

  imageUtils.marginImage( {
    img,
    fill: true,
    center: true,
    graphics: canvases.imageBuffer,
    position: createVector(
      width / 2,
      height / 2
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
    )
  };

  // const velocityMagnitude = 5;
  //
  // Body.setVelocity(
  // 	newImageBall.ball,
  // 	Vector.create(
  // 		random(-velocityMagnitude),
  // 		random(velocityMagnitude)
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

sketch.setup(
  () => {
    canvases.mask = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
    );
    canvases.imageBuffer = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
    );

    // canvases.mask.pixelDensity(options.backgroundPixelDensity || 0.5);
    background( ...options.colors.background );

    const margin = 50;
    const thickness = 50;

    addBoundary(
      width / 2,
      height + thickness / 2 - margin,
      width,
      thickness
    );
    addBoundary(
      width / 2,
      -thickness / 2 + margin,
      width,
      thickness
    );
    addBoundary(
      -thickness / 2 + margin,
      height / 2,
      thickness,
      height
    );
    addBoundary(
      width + thickness / 2 - margin,
      height / 2,
      thickness,
      height
    );

    for ( let i = 0; i <= 10; i++ ) {
      addImageBall(
        // random(cache.get("images")).img,
        cache.get( "images" )[ 0 ].img,
        random( width ),
        random( height ),
        ( width / 6 - 2 * margin )
        // random(100)
      );
    }

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

sketch.draw( (
  time, center, favoriteColor
) => {
  background( ...options.colors.background );

  // if (frameCount === 1) {
  // 	for (let i = 0; i < 120; i++) {
  // 		Engine.update(matter.engine);
  // 	}
  // }

  Engine.update( matter.engine );

  matter.engine.gravity = Vector.create(
    // mappers.fn(animation.circularProgression, 0, 1, -1, 1, easing.easeInOutExpo),
    // mappers.fn(animation.circularProgression, 0, 1, -1, 1, easing.easeInOutExpo)
    mappers.fn(
      sin( animation.angle * 2 ),
      -1,
      1,
      -1,
      1,
      easing.easeInOutExpo
    ),
    mappers.fn(
      cos( animation.angle * 2 ),
      -1,
      1,
      -1,
      1,
      easing.easeInOutExpo
    ),

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
      }, circleRadius
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
        }
      } = ball;

      // stroke(0, 0, 0, map(position.dist(_position), 0, 1000, 0, 100));

      strokeWeight( 1 );
      line(
        x,
        y,
        _x,
        _y
      );
      links.push( `${ index }-${ _index }` );
    } );

    drawImageWithMask( {
      img,
      maskDrawer: graphics => {
        graphics.fill( 255 );
        graphics.noStroke();
        graphics.ellipse(
          x,
          y,
          circleRadius * 2,
          circleRadius * 2
        );
      }
    } );
  } );

  const defaultTitle = "variable-gravity-test".toUpperCase().replaceAll(
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
        size: 172,
        stroke: color( ...options.colors.text ),
        fill: color( ...options.colors.background ),
        font: string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: EXCLUSION
      }
    );
  }
} );
