import options from "../../utils/options.js";

import cache from "../../utils/cache.js";
import string from "../../utils/string.js";
import sketch from "../../utils/sketch.js";
import animation from "../../utils/animation.js";
import imageUtils from "../../utils/imageUtils.js";
import * as common from "../../utils/common.js";

// helpers
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

const getFont = () => {
  const key = options.sketch?.font ?? "martian";

  return ( string.fonts && string.fonts[ key ] ) || string.fonts.martian;
};

const getBg = () => options.sketch?.backgroundColor ?? [
  246,
  235,
  225
];
const getTextColor = () => options.sketch?.textColor ?? [
  0
];

const toBlendConstant = ( val ) => {
  if ( typeof val !== "string" ) return EXCLUSION;
  const k = val.toLowerCase().replace(
    /[\s-]/g,
    "_"
  );
  const map = {
    blend: BLEND,
    darkest: DARKEST,
    lightest: LIGHTEST,
    difference: DIFFERENCE,
    multiply: MULTIPLY,
    exclusion: EXCLUSION,
    screen: SCREEN,
    overlay: OVERLAY,
    hard_light: HARD_LIGHT,
    soft_light: SOFT_LIGHT,
    dodge: DODGE,
    burn: BURN,
    add: ADD,
    subtract: SUBTRACT,
  };

  return map[ k ] ?? EXCLUSION;
};

const degToRad = ( d ) => ( d * Math.PI ) / 180;

sketch.setup(
  () => {
    background( ...getBg() );
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    },
  }
);

sketch.draw( () => {
  background( ...getBg() );

  const imgs = getImages();

  // circle anchor from factors
  const circlePosition = createVector(
    ( options.sketch?.anchorXFactor ?? 0.5 ) * width,
    ( options.sketch?.anchorYFactor ?? 0.75 ) * height
  );

  // radii (note: matches original sin/cos swap)
  const radiusX = ( options.sketch?.radiusXFactor ?? 0.5 ) * height;
  const radiusY = ( options.sketch?.radiusYFactor ?? 0.5 ) * width;

  const startAngle = degToRad( options.sketch?.startAngleDeg ?? 270 );
  const endAngle = degToRad( options.sketch?.endAngleDeg ?? 90 );

  const imageScale = options.sketch?.imageScale ?? 0.5;
  const centerImage = options.sketch?.centerImage ?? true;

  const showDebugPoints = options.sketch?.showDebugPoints ?? false;
  const debugPointWeight = options.sketch?.debugPointWeight ?? 20;
  const debugPointColor = options.sketch?.debugPointColor ?? [
    255,
    0,
    0
  ];

  if ( imgs?.length ) {
    for ( let i = 0; i < imgs.length; i++ ) {
      const t = imgs.length > 1 ? i / ( imgs.length - 1 ) : 0;
      const angle = map(
        t,
        0,
        1,
        startAngle,
        endAngle
      );

      const imageObjectAtIndex = imgs[ i ];
      const imageAtIndex = imageObjectAtIndex.img ?? imageObjectAtIndex;

      const imagePosition = circlePosition.copy();

      imagePosition.add(
        Math.sin( angle ) * radiusX,
        Math.cos( angle ) * radiusY
      );

      imageUtils.marginImage( {
        img: imageAtIndex,
        position: imagePosition,
        scale: imageScale,
        center: centerImage,
      } );

      if ( showDebugPoints ) {
        stroke( ...debugPointColor );
        strokeWeight( debugPointWeight );
        point(
          imagePosition.x,
          imagePosition.y
        );
      }
    }
  }

  // Title
  const showTitle = options.sketch?.showTitle ?? true;
  const title = options.sketch?.title || options.name.replaceAll(
    "-",
    "\n"
  );
  const titleSize = options.sketch?.titleSize ?? 128;
  const titleBlend = toBlendConstant( options.sketch?.titleBlendMode ?? "exclusion" );
  const titleStart = options.sketch?.titleProgressStart ?? 0.0;
  const titleEnd = options.sketch?.titleProgressEnd ?? 0.2;

  if (
    showTitle &&
    animation.progression >= titleStart &&
    animation.progression <= titleEnd
  ) {
    string.write(
      title,
      0,
      height / 2,
      {
        size: titleSize,
        stroke: color( ...getTextColor() ),
        fill: color( ...getBg() ),
        font: getFont(),
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: titleBlend,
      }
    );
  }
} );
