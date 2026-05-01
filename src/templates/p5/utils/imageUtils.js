import cache from "./cache.js";
import shapes from "./shapes.js";
import options from "./options.js";
import * as common from "@/p5/utils/common.js";
import { getP5 } from "./sketch.js";

const imageUtils = {
  marginImage: ( {
    img,
    graphics = window,
    boundary = graphics,
    margin = 0,
    scale = 1,
    angle = 0,
    callback,
    center = false,
    clip = false,
    fill = false,
    position = null,
  } ) => {
    const p = getP5();
    if (position === null) {
      position = p.createVector(p.width / 2, p.height / 2);
    }
    const scaledBoundary = p.createVector(
      boundary.width * scale,
      boundary.height * scale
    );

    const availableWidth = fill
      ? boundary.width - margin
      : scaledBoundary.x - 2 * margin;
    const availableHeight = fill
      ? boundary.height - margin
      : scaledBoundary.y - 2 * margin;
    const screenHeightScale = availableHeight / img.height;
    const screenWidthScale = availableWidth / img.width;
    const screenScale = fill
      ? Math.max(
        screenWidthScale,
        screenHeightScale
      )
      : Math.min(
        screenWidthScale,
        screenHeightScale
      );

    const h = img.height * screenScale * scale;
    const w = img.width * screenScale * scale;

    graphics.push();

    if ( clip ) {
      graphics.clip(
        () => {
          graphics.rect(
            position.x - scaledBoundary.x / 2,
            position.y - scaledBoundary.y / 2,
            scaledBoundary.x,
            scaledBoundary.y
          );
        },
        {
          invert: false,
        }
      );
    }

    graphics.translate( position );
    graphics.rotate( angle );

    graphics.image(
      img,
      center ? -w / 2 : 0,
      center ? -h / 2 : 0,
      w,
      h
    );

    graphics.pop();

    callback?.(
      position.x,
      position.y,
      w,
      h
    );

    if ( options.lines ) {
      p.stroke( options?.colors?.accent || p.color(
        128,
        128,
        255
      ) );

      shapes.hl( clonedPosition.y );
      shapes.hl( clonedPosition.y + h );

      shapes.vl( clonedPosition.x );
      shapes.vl( clonedPosition.x + w );
    }
  },
  clearColor: (
    img, clr = null
  ) => {
    const p = getP5();
    if (clr === null) {
      clr = p.color(255, 255, 255);
    }
    img.loadPixels();

    const {
      levels: [
        _r,
        _g,
        _b
      ],
    } = clr;

    for ( let i = 0; i < img.pixels.length; i += 4 ) {
      let r = img.pixels[ i ];
      let g = img.pixels[ i + 1 ];
      let b = img.pixels[ i + 2 ];

      if ( r === _r && g === _g && b === _b ) {
        img.pixels[ i + 3 ] = 0;
      }
    }

    img.updatePixels();
  },
  getImages( sourcePath = "sketch.images" ) {
    const imagesFromOptions = sourcePath
      .split( "." )
      .reduce(
        (
          current, key
        ) => ( current !== undefined && current !== null ? current[ key ] : undefined ),
        options
      );

    if ( Array.isArray( imagesFromOptions ) && imagesFromOptions.length > 0 ) {
      return imagesFromOptions
        .map( ( imagePath ) => common.getAsset( imagePath ) )
        .filter( ( asset ) => asset !== undefined && asset !== null );
    }

    return cache.get( "images" ) ?? [
    ];
  }
};

export default imageUtils;
