import options from "@/p5/utils/options.js";

import exif from "@/p5/utils/exif.js";
import cache from "@/p5/utils/cache.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import * as common from "@/p5/utils/common.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

class Card {
  constructor( {
    position, index
  } ) {
    this.index = index;
    this.position = position;
    const images = getImages();

    this.img = images?.[ this.index ]?.img;
    this.path = images?.[ this.index ]?.path;
    this.filename = images?.[ this.index ]?.filename;
    this.exif = images?.[ this.index ]?.exif;
  }

  update() {
    // const { x: start, y: end } = this.limits;

    // const stepSize = (end - start) / 360; // Compute step size dynamically
    // const limitsLength = (end-start);
    // const limitUnit = p.abs(limitsLength)/cardsLength;

    // this.position.y += (
    //     easing.easeInOutExpo(animation.progression)
    // )*stepSize

    // this.position = animation.ease({
    //     values: cache.get("positions"),
    //     currentTime: (
    //         animation.progression*cardsLength
    //         +this.index
    //     ),
    //     easingFn: easing.easeInOutExpo,
    //     lerpFn: mappers.lerpVector
    // });

    // this.position.y = circularConstrain(this.position.y, start, end)

    this.updatePosition();
  }

  updatePosition() {
    const positions = cache.get( "positions" );
    const positionsCount = positions.length;

    // Calculate phase progression (0-1 loop) with staggered start per card
    const phase = ( animation.progression + this.index / positionsCount ) % 1;

    // Get current and next position indices with wrap-around
    const rawIndex = phase * positionsCount;

    this.currentIndex = Math.floor( rawIndex );
    this.nextIndex = ( this.currentIndex + 1 ) % positionsCount;

    // Calculate easing between current and next position
    const t = rawIndex - this.currentIndex;
    const easedT = easing.easeOutSine( t );

    // Lerp between positions
    this.position = mappers.lerpVector(
      positions[ this.currentIndex ],
      positions[ this.nextIndex ],
      easedT
    );

    if ( this.nextIndex === 0 ) {
      this.position = positions[ 0 ].copy();
    }
  }

  draw( graphics ) {
    const p = graphics;

    if ( !this.img ) {
      return;
    }

    graphics.push();
    graphics.translate( this.position );
    imageUtils.marginImage( {
      img: this.img,
      scale: 0.85,
      center: true,
      graphics
    } );
    graphics.pop();

    if ( !this.exif ) {
      return;
    }

    if ( this.currentIndex === ( options.sketch?.count ?? 200 ) - 2 ) {
      const exifInfoText = [
        exif.formatFocalLength( this?.exif?.focalLength ),
        exif.formatAperture( this?.exif?.aperture ),
        exif.formatShutterSpeed( this?.exif?.shutterSpeed ),
        exif.formatISO( this?.exif?.iso )
      ].join( " · " );

      p.push();
      p.translate(
        50,
        p.height
      );
      p.rotate( -p.PI / 2 );
      string.write(
        exifInfoText,
        0,
        0,
        {
        // graphics,
          size: 24,
          // fill: p.color(...options.colors.text),
          // stroke: p.color(...options.colors.background),

          stroke: p.color( ...( options.sketch?.textColor ?? options.colors.text ) ),
          fill: p.color( ...( options.sketch?.backgroundColor ?? options.colors.background ) ),

          font: string.fonts?.[ options.sketch?.font ] || string.fonts.martian,
          textWidth: p.height,
          popPush: false,
          textAlign: [
            p.CENTER,
            p.CENTER
          ],
          blendMode: p.DIFFERENCE
        }
      );
      p.pop();
    }
  }
}

const cards = [];
const canvases = {};
const cardsLength = options.sketch?.count ?? 200;

// helpers
const getBg = () =>
  options.sketch?.backgroundColor ??
  options.colors?.background ?? [
    230,
    230,
    230
  ];

const getTextColor = () =>
  options.sketch?.textColor ?? options.colors?.text ?? [
    0
  ];

const getImages = () => {
  const imagesFromOptions =
    options.sketch?.images && options.sketch.images.length
      ? options.sketch.images
      : null;

  const fromCache = cache.get( "images" );

  return imagesFromOptions
    ? imagesFromOptions.map( ( p ) => common.getAsset( p ) ).filter( Boolean )
    : fromCache || [];
};

sketch.setup( () => {
  const p = getP5();

  canvases._3d = p.createGraphics(
    p.width,
    p.height,
    "webgl"
  );

  p.background( ...getBg() );

  const start = p.createVector(
    0,
    ( p.height * 1 ) / 8 - p.height / 2,
    -500
  );
  const end = p.createVector(
    0,
    ( p.height * 2.75 ) / 4 - p.height / 2
  );

  cache.store(
    "positions",
    () =>
      Array.from( {
        length: cardsLength
      } ).map( (
        _, index
      ) => {
        const position = mappers.lerpVector(
          start,
          end,
          index / cardsLength
        );

        cards.push( new Card( {
          position,
          index
        } ) );

        return position;
      } )
  );
} );

sketch.draw( (
  _time, center, favoriteColor
) => {
  const p = getP5();
  // options.colors.text = [252, 209, 83]
  // p.background(...options.colors.background);

  // PHOTO 3D SLIDER
  p.image(
    canvases._3d,
    0,
    0,
    p.width,
    p.height
  );

  canvases._3d.background( ...getBg() );
  for ( const card of cards ) {
    card.update();
    card.draw( canvases._3d );
  }

  p.push();
  p.translate(
    p.width - 50,
    0
  );
  p.rotate( p.PI / 2 );
  string.write(
    String( Number( animation.progression ).toPrecision( 3 ) ).slice(
      0,
      5
    ),
    0,
    0,
    {
      size: 24,
      fill: p.color( ...getTextColor() ),
      stroke: p.color( ...getBg() ),
      font: string.fonts?.[ options.sketch?.font ] || string.fonts.martian,
      textWidth: p.height,
      popPush: false,
      textAlign: [
        p.CENTER,
        p.CENTER
      ]
    }
  );
  p.pop();

  // TEXTS OVER
  const textWriteOptions = {
    size: 172,
    stroke: p.color( ...getTextColor() ),
    fill: p.color( ...getBg() ),

    // stroke: p.color(0),
    // fill: p.color(255),
    font: string.fonts?.[ options.sketch?.font ] || string.fonts.martian,
    textAlign: [
      p.CENTER,
      p.CENTER
    ]
  };

  string.write(
    options.sketch?.topText || "top",
    0,
    animation.ease( {
      values: [
        p.height / 2 - 200,
        ( p.height * 1 ) / 8
      ],
      currentTime: animation.circularProgression,
      easingFn: easing.easeOutQuint
    } ),
    {
      ...textWriteOptions,
      blendMode: p.EXCLUSION
    }
  );

  string.write(
    options.sketch?.bottomText || "bottom",
    0,
    animation.ease( {
      values: [
        p.height / 2 + 200,
        ( p.height * 6.5 ) / 8
      ],
      currentTime: animation.circularProgression,
      easingFn: easing.easeOutQuint
    } ),
    {
      ...textWriteOptions,
      blendMode: p.EXCLUSION
    }
  );
} );
