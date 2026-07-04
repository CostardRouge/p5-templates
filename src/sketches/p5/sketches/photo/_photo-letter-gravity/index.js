import options from "@/p5/utils/options.js";
import events from "@/p5/utils/events.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import scripts from "@/p5/utils/scripts.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import Matter from "@/public/assets/libraries/matter.min.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

scripts.load( "/assets/libraries/decomp.min.js" );

const {
  Engine, Body, Bodies, Vector, Composite, Common
} = Matter;

Common.setDecomp( window.decomp );

const shape = [];

events.register(
  "engine-mouse-dragged",
  () => {
    const p = getP5();

    shape.push( p.createVector(
      p.mouseX,
      p.mouseY
    ) );
  }
);

events.register(
  "engine-mouse-released",
  () => {
    const p = getP5();
    const bodyObject = {
      body: Bodies.fromVertices(
        p.mouseX,
        p.mouseY,
        shape,
        {
          friction: 0.3,
          frictionAir: 0.0001,
          restitution: 0.9
        },
        false,
        0.01,
        10,
        0.1
      ),
      position: p.createVector(
        p.mouseX,
        p.mouseY
      ),
      points: [
        ...shape
      ]
    };

    if ( !bodyObject.body ) {
      shape.length = 0;
      return;
    }

    Composite.add(
      matter.engine.world,
      bodyObject.body
    );
    matter.bodies.push( bodyObject );

    shape.length = 0;
  }
);

const canvases = {
  mask: undefined,
  imageBuffer: undefined
};

const matter = {
  engine: Engine.create(),
  bottom: undefined,
  bodies: [],
  boundaries: []
};

function drawImageWithMask( {
  img, maskDrawer, graphics = getP5()
} ) {
  // p.image(img, 0, 0, graphics.width, graphics.height);

  imageUtils.marginImage( {
    img,
    fill: true,
    center: true,
    graphics: canvases.imageBuffer,
    position: p.createVector(
      p.width / 2,
      p.height / 2
    )
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

function addLetter(
  x, y, text, size = 72
) {
  const bodyObject = {
    text,
    size,
    points: undefined,
    position: p.createVector(
      x,
      y
    ),
    body: undefined // Bodies.circle(x, y, size, size)
  };

  matter.bodies.unshift( bodyObject );
  // Composite.add(matter.engine.world, bodyObject.body)
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
      isStatic: true
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
  p.background( ...options.colors.background );

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

  // "gravity".split("").forEach( letter => {
  // 	addLetter(
  // 		p.width/2,
  // 		p.height/2,
  // 		// p.random(p.width),
  // 		// p.random(p.height),
  // 		letter,
  // 		288
  // 	)
  // })
} );

sketch.draw( (
  time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...options.colors.background );

  Engine.update( matter.engine );

  if ( string.fonts.agiro.data ) {
    const emptyLetterPoints = matter.bodies.filter( ( {
      points
    } ) => points === undefined );

    emptyLetterPoints.forEach( ( bodyObject ) => {
      const {
        text, position, size
      } = bodyObject;

      bodyObject.points = string.getTextPoints( {
        text,
        size,
        position,
        // sampleFactor: .1,
        font: string.fonts.agiro
      } );

      bodyObject.body = Bodies.fromVertices(
        position.x,
        position.y,
        // bodyObject.points,
        // {
        // 	// friction: 0.5,
        // 	// restitution: 0.8,
        // 	// angle: p.PI
        // }
        // bodyObject.points.map(({x, y})=> Vector.create(x, y))
        bodyObject.points.map( ( {
          x, y
        } ) =>
          Vector.create(
            position.x - x,
            position.y - y
          ) )
      );

      if ( !bodyObject.body ) {
        return;
      }

      Composite.add(
        matter.engine.world,
        bodyObject.body
      );
    } );
  }

  matter.engine.gravity = Vector.create(
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
  );

  p.push();
  p.stroke( "blue" );
  p.strokeWeight( 1 );
  p.point(
    p.mouseX,
    p.mouseY
  );
  p.beginShape();
  for ( let i = 0; i < shape?.length; i++ ) {
    p.vertex(
      shape[ i ].x,
      shape[ i ].y
    );
  }
  p.endShape();
  p.pop();

  matter.bodies.forEach( (
    {
      body, points, position: {
        x, y
      }, size
    }, index
  ) => {
    if ( !body ) {
      p.strokeWeight( 50 );
      p.point(
        x,
        y
      );
      return;
    }

    const {
      position: {
        x: mX, y: mY
      },
      vertices,
      angle
    } = body;

    p.push();
    p.stroke( "blue" );

    // p.translate(mX, mY);
    // p.rotate(angle)
    p.beginShape();
    for ( let i = 0; i < vertices?.length; i++ ) {
      p.vertex(
        vertices[ i ].x,
        vertices[ i ].y
      );
    }
    p.endShape( p.CLOSE );

    p.strokeWeight( 50 );
    p.point(
      mX,
      mY
    );

    p.pop();

    // drawImageWithMask({
    // 	img: cache.get("images")[0].img,
    // 	maskDrawer: graphics => {
    // 		graphics.fill(255);
    // 		graphics.noStroke();
    // 		graphics.ellipse(x, y, size*2, size*2)
    // 	}
    // })
  } );

  const defaultTitle = "photo-text-gravity".toUpperCase().replaceAll(
    "-",
    "\n"
  );

  // if (animation.progression < 0.2) {
  // 	string.write(
  // 		defaultTitle,
  // 		p.width/2,
  // 		p.height/2,
  // 		{
  // 			size: 172,
  // 			stroke: p.color(...options.colors.text),
  // 			fill: p.color(...options.colors.background),
  // 			font: string.fonts.martian,
  // 			textAlign: [p.CENTER, p.CENTER],
  // 			blendMode: EXCLUSION
  // 		}
  // 	)
  // }
} );
