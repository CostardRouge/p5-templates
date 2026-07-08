import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";

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

    const innerSize = keepSize ? size : position.dist( nextPosition );

    graphics.circle(
      middlePosition.x,
      middlePosition.y,
      innerSize
    );
  }
};

const drawBackgroundGrid = (
  graphics, columns, rows
) => {
  const xSize = graphics.width / columns;
  const ySize = graphics.height / rows;

  graphics.strokeWeight( 1 );
  graphics.stroke( 255 );
  graphics.noFill();

  for ( let x = 0; x <= columns; x++ ) {
    graphics.line(
      x * xSize,
      0,
      x * xSize,
      graphics.height
    );
  }

  for ( let y = 0; y <= rows; y++ ) {
    graphics.line(
      0,
      y * ySize,
      graphics.width,
      y * ySize
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
  const morph = options.sketch?.morph ?? {};
  const flower = options.sketch?.flower ?? {};
  const color = options.sketch?.color ?? {};
  const grid = options.sketch?.grid ?? {};

  const word = shape.text ?? "*+";
  const fontName = shape.font ?? "serif";
  const font = string.fonts?.[ fontName ] ?? string.fonts.serif;
  const size = ( shape.size ?? 0.88 ) * p.width;
  const sampleFactor = shape.sampleFactor ?? 0.5;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;

  if ( word.length === 0 || !font?.font ) {
    return;
  }

  const morphSpeed = morph.speed ?? 1;
  const morphEasingFn = easing?.[ morph.easing ] ?? easing.easeInOutExpo;
  const phase = animation.angle * morphSpeed / p.TAU;

  const currentLetter = mappers.circularIndex(
    phase,
    word
  );
  const nextLetter = mappers.circularIndex(
    phase + 1,
    word
  );

  const currentLetterPoints = string.getTextPoints( {
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

  const nextLetterPoints = string.getTextPoints( {
    text: nextLetter,
    position: p.createVector(
      0,
      0
    ),
    size,
    font,
    sampleFactor,
    simplifyThreshold
  } );

  if ( currentLetterPoints.length === 0 || nextLetterPoints.length === 0 ) {
    return;
  }

  // Optional background grid
  if ( grid.show ) {
    p.push();
    p.translate(
      -p.width / 2,
      -p.height / 2,
      grid.depth ?? -120
    );
    drawBackgroundGrid(
      p,
      grid.columns ?? 10,
      grid.rows ?? 10
    );
    p.pop();
  }

  const petalCount = flower.petals ?? 7;
  const petalSize = flower.size ?? 40;
  const positionScale = flower.positionScale ?? 2;
  const rotationSpeed = flower.rotationSpeed ?? 1;
  const rotationPerPoint = flower.rotationPerPoint ?? 7;

  const colorFunction = colors?.[ color.palette ] ?? colors.rainbow;
  const hueMultiplier = color.hueMultiplier ?? 1;
  const hueOffsetSpeed = color.hueOffsetSpeed ?? 1;
  const opacityMin = color.opacityMin ?? 1;
  const opacityMax = color.opacityMax ?? 3;
  const opacityFrequency = color.opacityFrequency ?? 100;
  const opacitySpeed = color.opacitySpeed ?? 5;

  const strokeWeightValue = options.sketch?.strokeWeight ?? 2;

  p.strokeWeight( strokeWeightValue );
  p.noFill();

  for ( let i = 0; i < currentLetterPoints.length; i++ ) {
    const progression = p.map(
      i,
      0,
      currentLetterPoints.length - 1,
      0,
      1
    );
    const targetIndex = ~~p.map(
      i,
      0,
      currentLetterPoints.length - 1,
      0,
      nextLetterPoints.length - 1,
      true
    );

    const lerped = animation.ease( {
      values: [
        currentLetterPoints[ i ],
        nextLetterPoints[ targetIndex ]
      ],
      currentTime: phase,
      duration: 1,
      easingFn: morphEasingFn,
      lerpFn: mappers.lerpVector,
      startIndex: 0,
      endIndex: 1
    } );

    p.stroke( colorFunction( {
      hueOffset: animation.angle * hueOffsetSpeed,
      hueIndex: mappers.fn(
        progression,
        0,
        1,
        -p.PI,
        p.PI
      ) * hueMultiplier,
      opacityFactor: p.map(
        p.sin( progression * opacityFrequency + animation.angle * opacitySpeed ),
        -1,
        1,
        opacityMax,
        opacityMin
      )
    } ) );

    p.push();
    p.translate(
      lerped.x * positionScale,
      lerped.y * positionScale
    );
    p.rotate( -animation.angle * rotationSpeed + progression * rotationPerPoint );
    drawFlower(
      p,
      petalSize,
      petalCount,
      flower.keepSize ?? false
    );
    p.pop();
  }
} );
