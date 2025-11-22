import options from "../../utils/options.js";
import cache from "../../utils/cache.js";
import sketch from "../../utils/sketch.js";
import imageUtils from "../../utils/imageUtils.js";
import * as common from "../../utils/common.js";

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

const getBg = () => options.sketch?.colors?.background ?? [
  246,
  235,
  225
];
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
  const arcConfig = options.sketch?.arc ?? {
  };
  const imageConfig = options.sketch?.image ?? {
  };
  const debugConfig = options.sketch?.debug ?? {
  };

  const circlePosition = createVector(
    ( arcConfig.anchorX ?? 0.5 ) * width,
    ( arcConfig.anchorY ?? 0.75 ) * height
  );

  const radiusX = ( arcConfig.radiusX ?? 0.5 ) * height;
  const radiusY = ( arcConfig.radiusY ?? 0.5 ) * width;

  const startAngle = degToRad( arcConfig.startAngle ?? 270 );
  const endAngle = degToRad( arcConfig.endAngle ?? 90 );

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
        scale: imageConfig.scale ?? 0.5,
        center: imageConfig.center ?? true
      } );

      if ( debugConfig.showPoints ) {
        stroke( ...( debugConfig.pointColor ?? [
          255,
          0,
          0
        ] ) );
        strokeWeight( debugConfig.pointWeight ?? 20 );
        point(
          imagePosition.x,
          imagePosition.y
        );
      }
    }
  }

  title.renderTitle(
    options,
    options.name
  );
} );
