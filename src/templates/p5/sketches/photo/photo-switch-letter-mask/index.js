import options from "@/p5/utils/options.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";

import {
  getFixedOrVariableOption
} from "@/p5/utils/common.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const canvases = {};

sketch.setup( () => {
  const p = getP5();

  canvases.mask = p.createGraphics(
    p.width,
    p.height
  );

  p.background( ...options.sketch.backgroundColor );
} );

sketch.draw( (
  time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();

  const imageSwitchSpeed = 3 / 2; // images.length;
  const imageObject = mappers.circularIndex(
    imageSwitchSpeed * animation.progression * images.length,
    images
  );

  imageUtils.marginImage( {
    img: imageObject.img,
    scale: options.sketch.imageStyle.scale ?? 1,
    center: options.sketch.imageStyle.center ?? true,
    fill: options.sketch.imageStyle.fill ?? true
  } );

  const itemsToMorph = [];

  if ( "single" === options.sketch.text.mode ) {
    itemsToMorph.push( ...( options.sketch.text.value.split( "" ) ) );
  }

  if ( "multiple" === options.sketch.text.mode ) {
    itemsToMorph.push( ...options.sketch.text.value );
  }

  if ( itemsToMorph.length === 0 ) {
    itemsToMorph.push( ...( "0123456789".split( "" ) ) );
  }

  const size = options.sketch.textStyle.size * ( ( p.height + p.width ) / 2 ) ?? ( p.height + p.width ) / 2;
  const font = string.fonts?.[ options.sketch?.textStyle.font ] ?? string.fonts.serif;
  const sampleFactor = options.sketch.textStyle.sampleFactor ?? 0.05;
  const simplifyThreshold = options.sketch.textStyle.simplifyThreshold ?? 0;

  canvases.mask.clear();

  const points = animation.ease( {
    values: itemsToMorph.map( ( text ) =>
      string.getTextPoints( {
        text,
        size,
        font,
        sampleFactor,
        simplifyThreshold,
        position: center
      } ) ),
    lerpFn: mappers.lerpPoints,
    currentTime: animation.progression * itemsToMorph.length,
    easingFn: easing.easeInOutExpo
  } );

  // canvases.mask.beginShape();
  for ( let i = 0; i < points.length; i++ ) {
    const pointsProgression = i / ( points.length - 1 );

    canvases.mask.strokeWeight( getFixedOrVariableOption(
      "strokeWeight",
      pointsProgression
    ) );

    // canvases.mask.rect(points[i].x, points[i].y, 30, 30);
    // canvases.mask.vertex(
    //   points[ i ].x,
    //   points[ i ].y
    // );
    canvases.mask.point(
      points[ i ].x,
      points[ i ].y
    );
  }
  // canvases.mask.endShape( );

  const mask = displayMask(
    p,
    canvases.mask
  );

  p.background( ...options.sketch.backgroundColor );
  p.image(
    mask,
    0,
    0
  );
} );

function displayMask(
  source = getP5(), mask
) {
  const maskedImage = source.get();

  maskedImage.mask( mask );

  return maskedImage;
}
