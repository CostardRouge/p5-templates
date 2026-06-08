import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

const drawFlower = (
  graphics, size, step, keepSize
) => {
  const TAU = graphics.TAU;
  const incrementStep = TAU / step;

  for ( let angle = 0; angle <= TAU; angle += incrementStep ) {
    const position = graphics.createVector(
      size * graphics.sin( angle ),
      size * graphics.cos( angle )
    );
    const nextPosition = graphics.createVector(
      size * graphics.sin( angle + incrementStep ),
      size * graphics.cos( angle + incrementStep )
    );
    const middlePosition = graphics.createVector(
      size * graphics.sin( angle + incrementStep / 2 ),
      size * graphics.cos( angle + incrementStep / 2 )
    );
    const innerSize = keepSize ? size / 1.2 : position.dist( nextPosition );

    graphics.circle(
      middlePosition.x,
      middlePosition.y,
      innerSize
    );
  }
};

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch?.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const shape = options.sketch?.shape ?? {};
  const flower = options.sketch?.flower ?? {};
  const color = options.sketch?.color ?? {};

  const word = shape.text ?? "*";
  const fontName = shape.font ?? "sans";
  const font = string.fonts?.[ fontName ] ?? string.fonts.sans;
  const size = ( shape.size ?? 0.92 ) * p.width;
  const sampleFactor = shape.sampleFactor ?? 0.75;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;

  if ( word.length === 0 || !font?.font ) {
    return;
  }

  p.strokeWeight( options.sketch?.strokeWeight ?? 3 );
  p.noFill();

  const phase = animation.angle / p.TAU;
  const currentLetter = mappers.circularIndex(
    phase,
    word
  );

  const letterPoints = string.getTextPoints( {
    text: currentLetter,
    position: p.createVector(
      0,
      0
    ),
    size,
    font,
    sampleFactor,
    simplifyThreshold
  } );

  if ( letterPoints.length === 0 ) {
    return;
  }

  const petalCount = flower.petals ?? 3;
  const positionScale = flower.positionScale ?? 2;
  const sizeMin = flower.sizeMin ?? 0;
  const sizeMax = flower.sizeMax ?? 50;
  const sizeFrequency = flower.sizeFrequency ?? 0.25;
  const rotationSpeed = flower.rotationSpeed ?? 1;
  const rotationPerPoint = flower.rotationPerPoint ?? 1;
  const keepSize = flower.keepSize ?? false;

  const palette = color.palette ?? "test";
  const colorFunction = colors?.[ palette ] ?? colors.test;
  const hueEasing = easing?.[ color.hueEasing ] ?? easing.easeInCubic;
  const hueMultiplier = color.hueMultiplier ?? 1;
  const opacitySinSpeed = color.opacitySinSpeed ?? 4;
  const opacitySinFreq = color.opacitySinFreq ?? 50;
  const opacityCosSpeed = color.opacityCosSpeed ?? 2;
  const opacityMaxMax = color.opacityMaxMax ?? 5;
  const opacityMaxMin = color.opacityMaxMin ?? 1;

  for ( let i = 0; i < letterPoints.length; i++ ) {
    const progression = p.map(
      i,
      0,
      letterPoints.length - 1,
      0,
      1
    );

    const {
      x,
      y
    } = letterPoints[ i ];

    const opacityMaxLocal = mappers.fn(
      p.cos( progression * opacitySinFreq + animation.angle * opacityCosSpeed ),
      -1,
      1,
      opacityMaxMax,
      opacityMaxMin,
      easing.easeInCubic
    );
    const opacityFactor = mappers.fn(
      p.sin( progression * opacitySinFreq + animation.angle * opacitySinSpeed ),
      -1,
      1,
      opacityMaxLocal,
      1,
      easing.easeInSine
    );

    p.stroke( colorFunction( {
      hueIndex: mappers.fn(
        progression,
        0,
        1,
        -p.PI,
        p.PI,
        hueEasing
      ) * hueMultiplier,
      opacityFactor
    } ) );

    p.push();
    p.translate(
      x * positionScale,
      y * positionScale
    );
    p.rotate( -animation.angle * rotationSpeed + progression * rotationPerPoint );
    const dynamicSize = mappers.circularIndex(
      animation.angle * sizeFrequency + progression,
      [
        sizeMin,
        sizeMax
      ]
    );

    drawFlower(
      p,
      dynamicSize,
      petalCount,
      keepSize
    );
    p.pop();
  }

  renderTitle();
} );
