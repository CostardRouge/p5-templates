import cache from "@/p5/utils/cache.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

/* ------------------------------------------------------------------ */
/*  Cover-cropped photo textures                                       */
/*                                                                     */
/*  Shared helpers for the 3D photo sketches (stack, sphere, …): bake  */
/*  a photo into an offscreen graphic, cover-cropped to a target       */
/*  aspect ratio with an optional polaroid-style frame, then cache it  */
/*  per (asset, aspect, frame) so it is only rasterised once.          */
/* ------------------------------------------------------------------ */

/**
 * Aspect ratio (width / height) for a named photo shape. "auto" tracks the
 * current canvas so cards match the output format.
 */
export function shapeAspect( shape ) {
  const p = getP5();

  switch ( shape ) {
    case "square":
      return 1;
    case "landscape":
      return 4 / 3;
    case "portrait":
      return 3 / 4;
    default:
      return p.width / p.height;
  }
}

/** Texture pixel size whose long edge is `long`, preserving `aspect`. */
export function textureResolution(
  aspect, long = 512
) {
  if ( aspect >= 1 ) {
    return {
      width: long,
      height: Math.round( long / aspect )
    };
  }

  return {
    width: Math.round( long * aspect ),
    height: long
  };
}

/**
 * Normalise a loose frame option into the shape the bakers expect.
 * Accepts `{ enabled?, color?, thickness? }` and fills in safe defaults.
 */
export function resolveFrame( frame = {} ) {
  return {
    enabled: Boolean( frame.enabled ),
    color: frame.color ?? [
      255,
      255,
      255,
      255
    ],
    thickness: Math.max(
      0,
      Math.min(
        0.45,
        frame.thickness ?? 0.04
      )
    )
  };
}

/**
 * Bake one photo into an offscreen graphic: cover-cropped to `aspect`, with an
 * optional solid frame (polaroid-style border) around the image.
 */
export function bakePhoto( {
  img, aspect, frame, long = 512
} ) {
  const p = getP5();
  const {
    width,
    height
  } = textureResolution(
    aspect,
    long
  );
  const graphics = p.createGraphics(
    width,
    height
  );

  graphics.pixelDensity( 1 );
  graphics.clear();

  const inset = frame.enabled
    ? Math.round( Math.min(
      width,
      height
    ) * frame.thickness )
    : 0;

  if ( frame.enabled ) {
    graphics.noStroke();
    graphics.fill( ...frame.color );
    graphics.rect(
      0,
      0,
      width,
      height
    );
  }

  const innerWidth = width - 2 * inset;
  const innerHeight = height - 2 * inset;
  const scale = Math.max(
    innerWidth / img.width,
    innerHeight / img.height
  );
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const context = graphics.drawingContext;

  context.save();
  context.beginPath();
  context.rect(
    inset,
    inset,
    innerWidth,
    innerHeight
  );
  context.clip();
  graphics.image(
    img,
    inset + ( innerWidth - drawWidth ) / 2,
    inset + ( innerHeight - drawHeight ) / 2,
    drawWidth,
    drawHeight
  );
  context.restore();

  return graphics;
}

/**
 * Cover-cropped, cached texture for one photo asset. Returns null while the
 * underlying image is still loading so the slot can be skipped for now.
 */
export function getCoverTexture( {
  asset, aspect, frame, keyPrefix = "cover-tex", long = 512
} ) {
  const img = asset?.img;

  if ( !img || !img.width ) {
    return null;
  }

  const key = `${ keyPrefix }|${ asset.path }|${ aspect.toFixed( 4 ) }`
    + `|frame:${ frame.enabled ? 1 : 0 }-${ frame.color.join( "_" ) }-${ frame.thickness }`
    + `|long:${ long }`;
  const cached = cache.get( key );

  if ( cached ) {
    return cached;
  }

  return cache.set(
    key,
    bakePhoto( {
      img,
      aspect,
      frame,
      long
    } )
  );
}
