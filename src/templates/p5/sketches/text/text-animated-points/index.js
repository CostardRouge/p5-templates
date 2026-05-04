import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import mappers from "@/p5/utils/mappers.js";
import easing from "@/p5/utils/easing.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const sketchState = {
  shape: {
    graphics: null
  }
};

sketch.setup( ( {
  canvas
} ) => {
  const p = getP5();

  sketchState.shape.graphics = p.createGraphics(
    p.width,
    p.height,
    "webgl"
  );

  p.background( ...getBackgroundColor() );
} );

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    246,
    235,
    225
  ];

sketch.draw( () => {
  const p = getP5();

  p.background( ...getBackgroundColor() );

  const textToWrite = options.sketch?.shape?.text ?? "x";
  const fontName = options.sketch?.shape?.font ?? "martian";

  const size = options.sketch?.shape?.size * p.width ?? p.width;
  const sampleFactor = options.sketch?.shape?.sampleFactor ?? 0.1;
  const simplifyThreshold = options.sketch?.shape?.simplifyThreshold ?? 0;

  const textPoints = string.getTextPoints( {
    text: textToWrite,
    position: p.createVector(
      0,
      0
    ),
    size,
    font: string.fonts?.[ fontName ],
    sampleFactor,
    simplifyThreshold
  } );

  textPoints.forEach( (
    position, index
  ) => {
    const nextPosition = textPoints[ index + 1 ];

    if ( !nextPosition ) {
      return;
    }

    sketchState.shape.graphics.push();
    sketchState.shape.graphics.strokeWeight( 5 );
    // sketchState.shape.graphics.translate( position );

    const fillAlphaStart = options.sketch?.color?.fillAlphaStart ?? 240;
    const fillAlphaEnd = options.sketch?.color?.fillAlphaEnd ?? 0;
    const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 200;

    const rotationMax = p.TAU;

    const rotation = animation.ease( {
      values: [
        p.createVector(
          0,
          0
        ),
        p.createVector(
          0,
          rotationMax
        ),
        p.createVector(
          0,
          rotationMax
        ),
        p.createVector(
          rotationMax,
          0
        )
      ],
      currentTime: animation.progression,
      easingFn: easing.easeInOutExpo,
      lerpFn: mappers.lerpVector
    } );

    const {
      x: rX, y: rY, z: rZ
    } = rotation;

    // sketchState.shape.graphics.rotateX( rX );
    // sketchState.shape.graphics.rotateY( rY );
    // sketchState.shape.graphics.rotateZ( rZ );

    const fillAlpha = animation.ease( {
      values: [
        fillAlphaEnd,
        fillAlphaStart
      ],
      currentTime: animation.progression,
      easingFn: easing.easeInOutElastic
    } );

    const hue = sketchState.shape.graphics.noise(
      position.x / p.width +
        +sketchState.shape.graphics.map(
          Math.sin( animation.angle ),
          -1,
          1,
          0,
          1
        ),
      position.y / p.height +
        +sketchState.shape.graphics.map(
          Math.cos( animation.angle ),
          -1,
          1,
          0,
          1
        )
    );
    const hueMultiplier = options.sketch?.color?.hueMultiplier ?? 2;
    const opacityFactor = options.sketch?.color?.opacityFactor ?? 1.5;

    const tint = colors.rainbow( {
      hueOffset: animation.circularProgression,
      hueIndex:
        sketchState.shape.graphics.map(
          hue,
          0,
          1,
          -p.PI,
          p.PI
        ) * hueMultiplier,
      opacityFactor
    } );

    const {
      levels: [
        red,
        green,
        blue
      ]
    } = tint;

    sketchState.shape.graphics.fill(
      red,
      green,
      blue,
      fillAlpha
    );
    sketchState.shape.graphics.stroke(
      red,
      green,
      blue,
      strokeAlpha
    );

    sketchState.shape.graphics.line(
      position.x,
      position.y,
      nextPosition.x,
      nextPosition.y
    );

    // sketchState.shape.graphics.line(
    //   position.x,
    //   position.y,
    //   nextPosition.x,
    //   nextPosition.y
    // );

    // sketchState.shape.graphics.translate(
    //   position.x,
    //   position.y,
    // );

    // sketchState.shape.graphics.rotate( p.radians( position.z ) );
    //
    // sketchState.shape.graphics.line(
    //   0,
    //   0,
    //   100,
    //   0
    // );

    sketchState.shape.graphics.pop();
  } );

  p.image(
    sketchState.shape.graphics,
    0,
    0
  );
  sketchState.shape.graphics.clear();
} );
