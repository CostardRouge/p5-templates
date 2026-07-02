import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import cache from "@/p5/utils/cache.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import events from "@/p5/utils/events.js";
import gridMask from "@/p5/utils/gridMask.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";

import addScreenPositionFunction from "@/utils/addScreenPositionFunction.js";

const interactive = {
  currentTimeValue: 0,
  graphics: null,
  position: null,
  image: null
};

events.register(
  "engine-window-preload",
  () => {
    const p = getP5();

    interactive.image = p.loadImage( "/assets/images/handpointing.png" );
  }
);

sketch.setup(
  async( {
    canvas
  } ) => {
    const p = getP5();

    interactive.graphics = p.createGraphics(
      p.width,
      p.height
    );

    p.background( ...getBackgroundColor() );

    await addScreenPositionFunction( p );
  },
  {
    type: "webgl"
  }
);

// Multi-layer boolean mask delegated to the shared gridMask utility. Each font
// layer's per-cell field is computed once (spatial-hash accelerated) and
// cached; the assembled point list is cached too so it stays stable across
// frames. Behaviour is identical to the previous inline reduction.
async function createGridAlphaPoints(
  gridOptions, textPointsMatrix, cacheKey
) {
  const storeKey = `alpha-points-matrix+${ cacheKey }`;
  const cached = cache.get( storeKey );

  if ( cached !== undefined ) {
    return cached;
  }

  const distance = options.sketch?.mask?.distance ?? 0.015;
  const fields = [];

  for ( let i = 0; i < textPointsMatrix.length; i++ ) {
    fields.push( await gridMask.field( {
      gridOptions,
      points: textPointsMatrix[ i ],
      signature: `${ cacheKey }+${ i }`,
      distance,
      space: "normalized",
      output: "boolean",
      excludeZeroDistance: true
    } ) );
  }

  const {
    cells
  } = fields[ 0 ];

  const alphaPoints = cells.map( (
    cell, index
  ) => ( {
    position: cell.position,
    layers: fields.map( ( field ) => field.alpha[ index ] )
  } ) );

  cache.set(
    storeKey,
    alphaPoints
  );

  return alphaPoints;
}

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    246,
    235,
    225
  ];

sketch.draw( async() => {
  const p = getP5();

  p.clear();
  p.background( ...getBackgroundColor() );

  const size = options.sketch?.shape?.size * p.width ?? p.width;
  const sampleFactor = options.sketch?.shape?.sampleFactor ?? 0.1;
  const simplifyThreshold = options.sketch?.shape?.simplifyThreshold ?? 0;

  const columns = options.sketch?.shape?.columns ?? 65;
  const rows = ( columns * p.height ) / p.width;
  const cellSize = p.width / columns;

  const gridOptions = {
    topLeft: p.createVector(
      -p.width / 2,
      -p.height / 2
    ),
    topRight: p.createVector(
      p.width / 2,
      -p.height / 2
    ),
    bottomLeft: p.createVector(
      -p.width / 2,
      p.height / 2
    ),
    bottomRight: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    rows,
    columns,
    centered: true
  };

  const fontName = options.sketch?.shape?.font ?? "martian";

  const fonts = [
    string.fonts.martian
    // string.fonts.multicoloure,
    // string.fonts.openSans,
    // string.fonts.sans,
    // string.fonts.serif
  ];

  const textToWrite = options.sketch?.shape?.text ?? "8";

  const textPointsMatrix = fonts.map( ( font ) =>
    string.getTextPoints( {
      text: textToWrite,
      position: p.createVector(
        0,
        0
      ),
      size,
      font: string.fonts?.[ fontName ],
      sampleFactor,
      simplifyThreshold
    } ) );

  if ( textPointsMatrix.some( ( matrix ) => matrix.length === 0 ) ) {
    return;
  }

  const cacheComponent = [
    textToWrite,
    cellSize,
    size,
    fontName,
    sampleFactor,
    simplifyThreshold,
    options.sketch?.mask?.distance
  ];
  const cacheKey = cacheComponent.join( "+" );

  const alphaPoints = await createGridAlphaPoints(
    gridOptions,
    textPointsMatrix,
    cacheKey
  );

  if ( options.sketch?.animation?.rotate ?? true ) {
    // rotationMax is expressed in half-turns (× PI), so the final v[3] pose
    // (rX = rotationMax) only reads as identical to the start pose (rX = 0)
    // once it sweeps a WHOLE number of full 2*PI turns per loop — snapped to
    // whole turns per loop.
    const rotationTurns = Math.round( ( options.sketch?.animation?.rotationCount ?? 2 ) / 2 );
    const rotationMax = p.TAU * rotationTurns;

    const {
      x: rX,
      y: rY
      // z: rZ
    } = animation.ease( {
      values: [
        p.createVector(),
        p.createVector(
          0,
          rotationMax
        ),
        p.createVector(
          rotationMax,
          rotationMax
        ),
        p.createVector( rotationMax )
      ],
      currentTime: animation.progression * 3,
      duration: 1,
      lerpFn: mappers.lerpVector,
      easingFn: easing.easeInOutExpo
      // easingFn: easing.easeInOutElastic,
      // easingFn: easing.easeInOutCirc,
    } );

    p.rotateX( rX );
    p.rotateY( rY );
  }

  alphaPoints.forEach( (
    {
      layers, position
    }, index
  ) => {
    const layer = mappers.circularIndex(
      animation.progression / 3,
      layers
    );
    // const layer = animation.ease({
    //   values: layers,
    //   currentTime: generalAnimationTime+1/2,
    //   duration: 1,
    //   easingFn: easing.easeInOutExpo
    // })

    if ( !layer ) {
      return;
    }

    const switchSpeed = options.sketch?.animation?.switchSpeed ?? 2;
    const switchIndexDivisor =
      options.sketch?.animation?.switchIndexDivisor ?? 5;
    const positionInfluence =
      options.sketch?.animation?.positionInfluence ?? 100;

    const hue = p.noise(
      position.x / columns + +p.map(
        p.sin( animation.angle ),
        -1,
        1,
        0,
        1
      ),
      position.y / rows + +p.map(
        p.cos( animation.angle ),
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
      hueIndex: p.map(
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

    p.push();

    const w = cellSize; // -2
    const h = cellSize; // -2
    const d = cellSize * ( options.sketch?.shape?.depth ?? 20 );

    p.translate( position );

    const fillAlphaStart = options.sketch?.color?.fillAlphaStart ?? 240;
    const fillAlphaEnd = options.sketch?.color?.fillAlphaEnd ?? 0;
    const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 200;

    if ( options.sketch.interactive.enabled && interactive.position ) {
      const screenPos = p.screenPosition(
        0,
        0,
        0
      );
      const distance = p.dist(
        interactive.position.x,
        interactive.position.y,
        screenPos.x,
        screenPos.y
      );

      interactive.currentTimeValue = p.map(
        distance,
        0,
        options.sketch.interactive.sensitivityMultiplier * p.width ?? p.width * 0.5,
        0,
        1
      );
    }

    const currentTimeValue = options.sketch.interactive.enabled
      ? interactive.currentTimeValue
      : animation.progression * switchSpeed +
        ( +index / alphaPoints.length / switchIndexDivisor +
          position.x / columns / positionInfluence +
          position.y / rows / positionInfluence );

    const constrainedTime = p.constrain(
      currentTimeValue,
      0,
      1
    );

    const fillAlpha = animation.ease( {
      values: [
        fillAlphaStart,
        fillAlphaEnd
      ],
      currentTime: constrainedTime,
      duration: 1,
      easingFn: easing.easeInOutExpo
    } );

    p.fill(
      red,
      green,
      blue,
      fillAlpha
    );
    p.stroke(
      red,
      green,
      blue,
      strokeAlpha
    );
    p.box(
      w,
      h,
      -d
    );

    p.pop();
  } );

  if ( options.sketch.interactive.enabled ) {
    if ( options.sketch.interactive.mouse ) {
      interactive.position = p.createVector(
        p.mouseX - p.width / 2,
        p.mouseY - p.height / 2
      );
    } else {
      // Idle-demo animated point (not live input) — sin/cos only return to
      // their start value when their multiplier is a WHOLE number of turns
      // per loop, so the raw sliders are snapped to whole turns per loop.
      const sinTurns = Math.round( options.sketch.interactive.sinMultiplier );
      const cosTurns = Math.round( options.sketch.interactive.cosMultiplier );

      interactive.position = p.createVector(
        p.sin( animation.angle * sinTurns ) *
          ( -p.width / 2 ) *
          0.8,
        p.cos( animation.angle * cosTurns ) *
          ( -p.height / 2 ) *
          0.8
      );

      interactive.graphics.clear();
      interactive.graphics.image(
        interactive.image,
        interactive.position.x,
        interactive.position.y
      );
      p.image(
        interactive.graphics,
        0,
        0
      );
    }
  }
} );
