import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
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

const getEasing = (
  name, fallback
) =>
  easing[ name ] ?? easing[ fallback ] ?? easing.linear;

const getPalette = ( name ) =>
  colors[ name ] ?? colors.rainbow;

// Split a flat point list into subcontours based on distance jumps.
// Threshold is relative to the canvas's larger dimension.
const splitContours = (
  points, relativeThreshold, canvasSize
) => {
  if ( points.length === 0 ) {
    return [];
  }

  const breakDistance = relativeThreshold * canvasSize;
  const contours = [];
  let current = [
    points[ 0 ]
  ];

  for ( let i = 1; i < points.length; i++ ) {
    const previous = points[ i - 1 ];
    const point = points[ i ];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const distance = Math.sqrt( dx * dx + dy * dy );

    if ( distance > breakDistance ) {
      contours.push( current );
      current = [];
    }
    current.push( point );
  }

  if ( current.length > 0 ) {
    contours.push( current );
  }

  return contours;
};

sketch.draw( () => {
  const p = getP5();
  const graphics = sketchState.shape.graphics;

  p.clear();
  p.background( ...getBackgroundColor() );

  const shape = options.sketch?.shape ?? {};
  const render = options.sketch?.render ?? {};
  const strokeCfg = options.sketch?.stroke ?? {};
  const displacement = options.sketch?.displacement ?? {};
  const rotation = options.sketch?.rotation ?? {};
  const color = options.sketch?.color ?? {};

  const textToWrite = shape.text ?? "x";
  const fontName = shape.font ?? "martian";
  const size = ( shape.size ?? 1 ) * p.width;
  const sampleFactor = shape.sampleFactor ?? 0.1;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;
  const closeContours = shape.closeContours ?? false;
  const contourBreakThreshold = shape.contourBreakThreshold ?? 0.05;

  const renderMode = render.mode ?? "lines";
  const skipFactor = Math.max(
    1,
    Math.floor( render.skipFactor ?? 1 )
  );
  const pointSize = render.pointSize ?? 6;
  const blendModeName = render.blendMode ?? graphics.BLEND;

  const strokeWeightMin = strokeCfg.weightMin ?? 5;
  const strokeWeightMax = strokeCfg.weightMax ?? strokeWeightMin;
  const strokeWeightEasingFn = getEasing(
    strokeCfg.weightEasing,
    "linear"
  );
  const pulseSpeed = strokeCfg.pulseSpeed ?? 1;

  const displacementEnabled = displacement.enabled ?? false;
  const displacementAmount = ( displacement.amount ?? 0 ) * p.width;
  const displacementNoiseScale = displacement.noiseScale ?? 2;
  const displacementAnimSpeed = displacement.animSpeed ?? 1;

  const rotationEnabled = rotation.enabled ?? false;
  const rotationAngleMax = rotation.angleMax ?? p.TAU;
  const rotationEasingFn = getEasing(
    rotation.easing,
    "easeInOutExpo"
  );

  const fillAlphaStart = color.fillAlphaStart ?? 240;
  const fillAlphaEnd = color.fillAlphaEnd ?? 0;
  const strokeAlpha = color.strokeAlpha ?? 200;
  const hueMultiplier = color.hueMultiplier ?? 2;
  const opacityFactor = color.opacityFactor ?? 1.5;
  const hueOffset = color.hueOffset ?? 0;
  const hueAnimSpeed = color.hueAnimSpeed ?? 1;
  const hueNoiseScale = color.hueNoiseScale ?? 1;
  const fillEasingFn = getEasing(
    color.fillEasing,
    "easeInOutElastic"
  );
  const paletteFn = getPalette( color.palette );

  // Loop-exact clock: sin/cos and the circular noise sampling below only close
  // when their rate is a WHOLE number of turns per loop, so every raw slider
  // rate is rounded before it multiplies animation.angle.
  const pulseCycles = Math.round( pulseSpeed );
  const hueCycles = Math.round( hueAnimSpeed );
  const displacementCycles = Math.round( displacementAnimSpeed );

  // Animation-driven values shared across all points.
  const pulseProgress = strokeWeightEasingFn( ( Math.sin( animation.angle * pulseCycles ) + 1 ) / 2 );
  const animatedStrokeWeight = p.lerp(
    strokeWeightMin,
    strokeWeightMax,
    pulseProgress
  );

  // animation.ease walks its 2 values circularly once every 2 units of
  // currentTime; with currentTime tied straight to progression (1 unit per
  // loop) it only ever covered half that walk, so it snapped back to
  // fillAlphaEnd at the seam instead of returning to it smoothly. Doubling
  // currentTime completes exactly one whole anchor cycle per loop.
  const fillAlpha = animation.ease( {
    values: [
      fillAlphaEnd,
      fillAlphaStart
    ],
    currentTime: animation.progression * 2,
    easingFn: fillEasingFn
  } );

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

  const subsampledPoints = skipFactor > 1
    ? textPoints.filter( (
      _, index
    ) => index % skipFactor === 0 )
    : textPoints;

  const canvasSize = Math.max(
    p.width,
    p.height
  );

  const contours = splitContours(
    subsampledPoints,
    contourBreakThreshold,
    canvasSize
  );

  graphics.push();
  graphics.blendMode( blendModeName );

  if ( rotationEnabled ) {
    // Same anchor-cycle fix as fillAlpha above — a 2-value ease needs
    // currentTime to sweep 2 units per loop to close.
    const rotationValue = animation.ease( {
      values: [
        0,
        rotationAngleMax
      ],
      currentTime: animation.progression * 2,
      easingFn: rotationEasingFn
    } );

    graphics.rotateX( rotationValue * ( rotation.xMultiplier ?? 0 ) );
    graphics.rotateY( rotationValue * ( rotation.yMultiplier ?? 0 ) );
    graphics.rotateZ( rotationValue * ( rotation.zMultiplier ?? 0 ) );
  }

  graphics.strokeWeight( animatedStrokeWeight );

  const drawPoints = renderMode === "points" || renderMode === "lines-and-points";
  const drawLines = renderMode === "lines" || renderMode === "lines-and-points";

  if ( drawPoints ) {
    graphics.noStroke();
  }

  contours.forEach( ( contour ) => {
    const pointCount = contour.length;

    if ( pointCount === 0 ) {
      return;
    }

    const drawnPoints = closeContours
      ? [
        ...contour,
        contour[ 0 ]
      ]
      : contour;

    for ( let i = 0; i < drawnPoints.length; i++ ) {
      const position = drawnPoints[ i ];
      const nextPosition = drawnPoints[ i + 1 ];

      const displacedPosition = displacementEnabled
        ? applyDisplacement(
          position,
          displacementAmount,
          displacementNoiseScale,
          displacementCycles,
          graphics,
          p
        )
        : position;

      const hue = graphics.noise(
        ( displacedPosition.x / p.width ) * hueNoiseScale +
          graphics.map(
            Math.sin( animation.angle * hueCycles ),
            -1,
            1,
            0,
            1
          ),
        ( displacedPosition.y / p.height ) * hueNoiseScale +
          graphics.map(
            Math.cos( animation.angle * hueCycles ),
            -1,
            1,
            0,
            1
          )
      );

      const tint = paletteFn( {
        hueOffset: animation.circularProgression + hueOffset,
        hueIndex:
          graphics.map(
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

      if ( drawLines && nextPosition ) {
        const displacedNext = displacementEnabled
          ? applyDisplacement(
            nextPosition,
            displacementAmount,
            displacementNoiseScale,
            displacementCycles,
            graphics,
            p
          )
          : nextPosition;

        graphics.stroke(
          red,
          green,
          blue,
          strokeAlpha
        );
        graphics.fill(
          red,
          green,
          blue,
          fillAlpha
        );
        graphics.line(
          displacedPosition.x,
          displacedPosition.y,
          displacedNext.x,
          displacedNext.y
        );
      }

      if ( drawPoints ) {
        graphics.fill(
          red,
          green,
          blue,
          fillAlpha
        );
        graphics.ellipse(
          displacedPosition.x,
          displacedPosition.y,
          pointSize,
          pointSize
        );
      }
    }
  } );

  graphics.pop();

  p.image(
    graphics,
    0,
    0
  );
  graphics.clear();
} );

const applyDisplacement = (
  position, amount, noiseScale, animSpeed, graphics, p
) => {
  const time = animation.angle * animSpeed;
  const noiseX = graphics.noise(
    ( position.x / p.width ) * noiseScale + Math.cos( time ),
    ( position.y / p.height ) * noiseScale + Math.sin( time )
  );
  const noiseY = graphics.noise(
    ( position.x / p.width ) * noiseScale + Math.sin( time ) + 100,
    ( position.y / p.height ) * noiseScale + Math.cos( time ) + 100
  );

  return {
    x: position.x + graphics.map(
      noiseX,
      0,
      1,
      -amount,
      amount
    ),
    y: position.y + graphics.map(
      noiseY,
      0,
      1,
      -amount,
      amount
    ),
    z: position.z ?? 0
  };
};
