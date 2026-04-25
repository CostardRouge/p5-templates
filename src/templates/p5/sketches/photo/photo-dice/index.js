import options from "@/p5/utils/options.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import renderTitle from "../../../utils/title/renderTitle";

const canvases = {
};

sketch.setup( () => {
  canvases.dice = createGraphics(
    sketch?.engine?.canvas?.width,
    sketch?.engine?.canvas?.height,
    WEBGL
  );

  background( ...options.sketch.backgroundColor );
} );

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
    canvases.dice.createVector( -HALF_PI ), // bottom
  ];

  for ( let i = 0; i < rotations.length; i++ ) {
    const {
      x: rX, y: rY /* , z: rZ */ } = rotations[ i ];

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
  clear();
  background( ...options.sketch.backgroundColor );

  // Images from UI or cache
  const images = imageUtils.getImages();

  const repeatImages = options.sketch?.repeatImages ?? true;

  // Motion controls
  const rotateSpeed = options.sketch?.rotateSpeed ?? 1;
  const easeFn = easing?.[ options.sketch?.easing ] || easing.easeInOutExpo;

  // Calculate current rotation target (6 faces in cycle)
  const {
    x: rX, y: rY /* , z: rZ */ } = animation.ease( {
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
      canvases.dice.createVector( HALF_PI ), // bottom
    ],
    currentTime: animation.progression * 6 * rotateSpeed,
    lerpFn: p5.Vector.lerp,
    easingFn: easeFn,
  } );

  // Prepare WEBGL canvas
  canvases.dice.push();
  canvases.dice.background( ...options.sketch.backgroundColor );

  canvases.dice.rotateX( rX );
  canvases.dice.rotateY( rY );

  const diceSizeFactor = options.sketch?.diceSizeFactor ?? 1.5;
  const faceScale = options.sketch?.faceScale ?? 0.65;

  dice(
    width / diceSizeFactor,
    (
      index, size
    ) => {
    // pick image for this face
      let imgObj = null;

      if ( images.length > 0 ) {
        const i = repeatImages ? index % images.length : index;

        imgObj = images[ i ];
      }

      if ( imgObj?.img ) {
        imageUtils.marginImage( {
          position: createVector(
            0,
            0
          ),
          img: imgObj.img,
          scale: faceScale,
          center: true,
          graphics: canvases.dice,
        } );
      } else {
      // fallback: draw a simple face label if no image
        canvases.dice.push();
        canvases.dice.noFill();
        canvases.dice.stroke(
          0,
          50
        );
        canvases.dice.rectMode( CENTER );
        canvases.dice.rect(
          0,
          0,
          size * 0.9,
          size * 0.9
        );
        canvases.dice.pop();
      }
    }
  );

  canvases.dice.pop();

  // Compose to main canvas
  image(
    canvases.dice,
    0,
    0
  );

  renderTitle();
} );
