import options from "@/p5/utils/options.js";
import animation from "@/p5/utils/animation.js";
import * as common from "@/p5/utils/common.js";
import easing from "@/p5/utils/easing.js";
import graphics from "@/p5/utils/graphics.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import sketch from "@/p5/utils/sketch.js";
import events from "@/p5/utils/events.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  setSketchOptions,
} from "@/p5/shared/syncSketchOptions.js";

const sketchState = {
  photoGraphics: null,
  point: null,
};

sketch.setup( () => {
  background( ...options.sketch.backgroundColor );

  sketchState.photoGraphics = graphics.createAutoResizableGraphics(
    width,
    height
  );
} );

events.register(
  "engine-canvas-mouse-pressed",
  () => {
    console.log( sketchState.point );
    // const photo = common.getAsset( options.sketch?.photo?.image );
    //
    // if ( !photo ) return;
    //
    // // Check if click is within photo bounds
    // const {
    //   x: photoX, y: photoY, w: photoW, h: photoH
    // } = cache.photoBounds;
    //
    // if (
    //   mouseX < photoX ||
    //   mouseX > photoX + photoW ||
    //   mouseY < photoY ||
    //   mouseY > photoY + photoH
    // ) {
    //   console.log( "Click outside photo bounds" );
    //   return;
    // }
    //
    // // Get the underlying canvas element from p5.Image
    // const imageElement = photo.img.canvas || photo.img.elt || photo.img;
    //
    // // Map Mouse (Canvas) -> Photo Display (with margins/scale) -> Original Image
    // const relativeX = mouseX - photoX;
    // const relativeY = mouseY - photoY;
    //
    // // Scale from displayed photo to original image dimensions
    // const scaleX = photo.img.width / photoW;
    // const scaleY = photo.img.height / photoH;
    //
    // const imageX = relativeX * scaleX;
    // const imageY = relativeY * scaleY;
    //
    // // Calculate normalized coordinates (0-1) for storage
    // const normalizedX = imageX / photo.img.width;
    // const normalizedY = imageY / photo.img.height;

    sketchState.point = {
      x: mouseX,
      y: mouseY
    };

    setSketchOptions( {
      ...options,
      sketch: {
        ...options.sketch,
        point: {
          ...sketchState.point
        },
      },
    } );
  }
);

sketch.draw( () => {
  clear();
  background( ...options.sketch.backgroundColor );

  const photo = common.getAsset( options.sketch.photo );

  if ( !photo?.img ) {
    return;
  }

  sketchState.photoGraphics.clear();

  const zoomSteps = 2;
  const zoomLevel = map(
    animation.triangleProgression( 2 ),
    0,
    1,
    0,
    zoomSteps,
    easing.easeOutExpo
  );
  const zoomScale = map(
    zoomLevel,
    0,
    zoomSteps,
    1,
    6
  );

  if ( sketchState.point ) {
    sketchState.photoGraphics.push();
    sketchState.photoGraphics.translate(
      sketchState.point.x,
      sketchState.point.y
    );
    sketchState.photoGraphics.scale( zoomScale );
    sketchState.photoGraphics.translate(
      -sketchState.point.x,
      -sketchState.point.y
    );
  }

  imageUtils.marginImage( {
    position: createVector(
      width / 2,
      height / 2
    ),
    graphics: sketchState.photoGraphics,
    margin: width * options.sketch?.margin,
    scale: options.sketch?.scale ?? 1,
    center: options.sketch?.center ?? true,
    clip: options.sketch?.clip ?? false,
    fill: options.sketch?.fill ?? true,
    img: photo.img,
  } );

  if ( sketchState.point ) {
    sketchState.photoGraphics.pop();
  }

  image(
    sketchState.photoGraphics,
    0,
    0
  );

  renderTitle();
} );
