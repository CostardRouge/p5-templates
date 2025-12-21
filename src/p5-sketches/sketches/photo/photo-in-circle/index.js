import options from "@/p5/utils/options.js";

import cache from "@/p5/utils/cache.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import * as common from "@/p5/utils/common.js";

// ---------- helpers ----------
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

const getEasing = (
  name, fallback = easing.easeInOutExpo
) =>
  easing?.[ name ] || fallback;

const rad = ( deg ) => ( deg * Math.PI ) / 180;

// ---------- setup/draw ----------
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

sketch.draw( (
  time, center
) => {
  background( ...getBg() );

  const imgs = getImages();

  if ( !imgs?.length ) {
    return;
  }

  // Controls from options.ts
  const orbitSpeed = options.sketch?.orbitSpeed ?? 1;
  const outerRadiusFactor = options.sketch?.outerRadiusFactor ?? 0.8; // away
  const innerRadiusFactor = options.sketch?.innerRadiusFactor ?? 0.25; // near

  const scaleStart = options.sketch?.scaleStart ?? 1.0;
  const scaleEnd = options.sketch?.scaleEnd ?? 0.65;
  const scaleEasingName = options.sketch?.scaleEasing ?? "easeInOutQuint";

  const indexRotDeg = options.sketch?.indexRotationDegrees ?? 180;
  const indexRotEasingName =
    options.sketch?.indexRotationEasing ?? "easeInExpo_";

  const noiseXDiv = options.sketch?.noiseXDiv ?? 2; // position.x / (width * divisor)
  const noiseRotFromDeg = options.sketch?.noiseRotationFromDeg ?? 360;
  const noiseRotToDeg = options.sketch?.noiseRotationToDeg ?? 0;
  const noiseRotEasingName =
    options.sketch?.noiseRotationEasing ?? "easeInOutQuint";

  const centerX = center.x;
  const centerY = center.y;

  for ( let i = 0; i < imgs.length; i++ ) {
    const imgObj = imgs[ i ];
    const imageAtIndex = imgObj?.img || imgObj; // be tolerant

    const progression = i / imgs.length;

    const base = map(
      animation.progression * orbitSpeed,
      0,
      1,
      TAU,
      0
    );
    const angle = progression * TAU + base;

    const away = createVector(
      centerX + sin( angle ) * width * outerRadiusFactor,
      centerY + cos( angle ) * height * outerRadiusFactor
    );

    const near = createVector(
      centerX + sin( angle ) * width * innerRadiusFactor,
      centerY + cos( angle ) * height * innerRadiusFactor
    );

    const pos = animation.ease( {
      values: [
        away,
        near
      ],
      currentTime: animation.circularProgression + progression / imgs.length,
      lerpFn: p5.Vector.lerp,
      easingFn: easing.easeInOutExpo,
    } );

    push();
    translate(
      pos.x,
      pos.y
    );

    const rotNoise = mappers.fn(
      noise(
        pos.x / ( width * noiseXDiv ),
        i
      ),
      0,
      1,
      rad( noiseRotFromDeg ),
      rad( noiseRotToDeg ),
      getEasing(
        noiseRotEasingName,
        easing.easeInOutQuint
      )
    );

    const rotIndex = mappers.fn(
      progression,
      0,
      1,
      -rad( indexRotDeg ),
      rad( indexRotDeg ),
      getEasing(
        indexRotEasingName,
        easing.easeInExpo_
      )
    );

    rotate( rotNoise );
    rotate( rotIndex );

    const imgScale = mappers.fn(
      animation.circularProgression,
      0,
      1,
      scaleStart,
      scaleEnd,
      getEasing(
        scaleEasingName,
        easing.easeInOutQuint
      )
    );

    imageUtils.marginImage( {
      img: imageAtIndex,
      position: createVector(
        0,
        0
      ),
      scale: imgScale,
      center: true,
      clip: !!options.sketch?.clipImage,
      margin: options.sketch?.imageMargin ?? 0,
    } );

    pop();
  }

  // Title overlay
  const titleVisibleFrom = options.sketch?.titleProgressStart ?? 0.0;
  const titleVisibleTo = options.sketch?.titleProgressEnd ?? 0.6;
  const within =
    animation.progression >= titleVisibleFrom &&
    animation.progression <= titleVisibleTo;

  if ( ( options.sketch?.showTitle ?? true ) && within ) {
    const customTitle = options.sketch?.title?.trim?.() || "";
    const fallback = ( options.name || "orbit-images" )
      .toUpperCase()
      .replaceAll(
        "-",
        "\n"
      );
    const title = customTitle !== "" ? customTitle : fallback;

    const blendValue = options.sketch?.titleBlendMode ?? "exclusion";

    string.write(
      title,
      0,
      height / 2,
      {
        size: options.sketch?.titleSize ?? 128,
        stroke: color( ...getTextColor() ),
        fill: color( ...getBg() ),
        font: getFont(),
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: blendValue,
      }
    );
  }
} );
