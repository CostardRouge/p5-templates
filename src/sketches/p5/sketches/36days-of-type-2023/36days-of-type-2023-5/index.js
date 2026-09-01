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

const sketchState = {
  interactive: {
    position: null,
    image: null
  },
  shape: {
    graphics: null
  }
};

events.register(
  "engine-window-preload",
  () => {
    const p = getP5();

    sketchState.interactive.image = p.loadImage( "/assets/images/cursors/handpointing.png" );
  }
);

sketch.setup( async( {
  canvas
} ) => {
  const p = getP5();

  sketchState.shape.graphics = p.createGraphics(
    p.width,
    p.height,
    "webgl"
  );

  p.background( ...getBackgroundColor() );

  await addScreenPositionFunction( sketchState.shape.graphics );
} );

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

// Where the interactive "cursor" is this frame, in canvas pixels: the mouse,
// or a scripted lissajous sweep. Null in the non-interactive wave modes.
function updateInteractivePosition( p ) {
  const waveConfig = options.sketch?.animation?.wave ?? {
    mode: "linear"
  };

  if ( waveConfig.mode !== "interactive" ) {
    sketchState.interactive.position = null;
    return;
  }

  if ( waveConfig.useMouse ) {
    sketchState.interactive.position = p.createVector(
      p.mouseX,
      p.mouseY
    );
    return;
  }

  const sinMult = waveConfig.sinMultiplier ?? 3;
  const cosMult = waveConfig.cosMultiplier ?? 1;

  sketchState.interactive.position = p.createVector(
    p.map(
      Math.sin( animation.angle * sinMult ),
      -1,
      1,
      0,
      p.width
    ),
    p.map(
      Math.cos( animation.angle * cosMult ),
      -1,
      1,
      0,
      p.height
    )
  );
}

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

  const textToWrite = options.sketch?.shape?.text ?? "5";

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

  // Resolved before the boxes are drawn so the field they react to and the
  // cursor drawn on top belong to the same frame (they used to be one frame
  // apart, which showed as lag during capture).
  updateInteractivePosition( p );

  alphaPoints.forEach( (
    {
      layers, position
    }, index
  ) => {
    const layer = mappers.circularIndex(
      animation.progression,
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

    const hue = sketchState.shape.graphics.noise(
      position.x / columns +
        +sketchState.shape.graphics.map(
          Math.sin( animation.angle ),
          -1,
          1,
          0,
          1
        ),
      position.y / rows +
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

    sketchState.shape.graphics.push();

    const w = cellSize; // -2
    const h = cellSize; // -2

    sketchState.shape.graphics.translate( position );

    const fillAlphaStart = options.sketch?.color?.fillAlphaStart ?? 240;
    const fillAlphaEnd = options.sketch?.color?.fillAlphaEnd ?? 0;
    const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 200;

    // Calculate wave propagation
    const normalizedX = p.map(
      position.x,
      -p.width / 2,
      p.width / 2,
      0,
      1
    );
    const normalizedY = p.map(
      position.y,
      -p.height / 2,
      p.height / 2,
      0,
      1
    );

    const waveConfig = options.sketch?.animation?.wave ?? {
      mode: "linear",
      directionX: -1,
      directionY: -1
    };
    const waveSpeed = options.sketch?.animation?.waveSpeed ?? 1;
    const waveSpread = options.sketch?.animation?.waveSpread ?? 0.3;

    let switchIndex;

    if ( waveConfig.mode === "interactive" ) {
      // Interactive mode: distance from cursor/animated point
      if ( sketchState.interactive.position ) {
        // screenPosition returns WEBGL-centered coordinates while the
        // interactive position is in canvas pixels, so bring the projected
        // point into pixel space before measuring — otherwise the field's hot
        // spot sits half a canvas away from the cursor drawn on top.
        const screenPos = sketchState.shape.graphics.screenPosition(
          0,
          0,
          0
        );
        const distance = p.dist(
          sketchState.interactive.position.x,
          sketchState.interactive.position.y,
          screenPos.x + p.width / 2,
          screenPos.y + p.height / 2
        );
        const sensitivity = waveConfig.sensitivity ?? 0.3;

        // Invert sensitivity: lower value = more impact (smaller radius)
        // Map distance to 0-1, where closer = higher value
        const normalizedDistance = p.map(
          distance,
          0,
          ( 1 / sensitivity ) * p.width * 0.5, // Inverted: lower sensitivity = larger radius
          1, // Close to cursor = 1
          0, // Far from cursor = 0
          true // Constrain
        );

        // Apply wave speed and spread like other modes
        switchIndex =
          ( animation.progression * waveSpeed +
            normalizedDistance * waveSpread ) %
          1;
      } else {
        switchIndex = 0;
      }
    } else {
      // Linear or Radial modes
      let waveOffset;

      if ( waveConfig.mode === "radial" ) {
        // Radial wave from center or edges
        const distanceFromCenter =
          p.dist(
            normalizedX,
            normalizedY,
            0.5,
            0.5
          ) / ( Math.sqrt( 2 ) / 2 );
        const fromCenter = waveConfig.fromCenter ?? true;

        waveOffset = fromCenter ? distanceFromCenter : 1 - distanceFromCenter;
      } else {
        // Linear wave with controllable direction
        const directionX = waveConfig.directionX ?? -1;
        const directionY = waveConfig.directionY ?? -1;
        const xComponent = directionX * ( normalizedX - 0.5 );
        const yComponent = directionY * ( normalizedY - 0.5 );

        waveOffset = ( xComponent + yComponent + 1 ) / 2; // Normalize to 0-1
      }

      switchIndex =
        ( animation.progression * waveSpeed + waveOffset * waveSpread ) % 1;
    }

    const fractionalPart = Math.abs( switchIndex - Math.round( switchIndex ) );
    const movementIndex = p.constrain(
      fractionalPart / 0.5,
      0,
      1
    );

    const depthMax = cellSize * ( options.sketch?.shape?.depth ?? 20 );

    const d = options.sketch.animation.variableDepth
      ? animation.ease( {
        values: [
          depthMax,
          cellSize
        ],
        currentTime: movementIndex,
        easingFn:
            easing?.[ options.sketch.animation.waveEasing ] ??
            easing.easeInOutElastic
      } )
      : depthMax;

    const fillAlpha = animation.ease( {
      values: [
        fillAlphaStart,
        fillAlphaEnd
      ],
      currentTime: movementIndex,
      easingFn:
        easing?.[ options.sketch.animation.waveEasing ] ??
        easing.easeInOutElastic
    } );

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

    if ( options.sketch?.animation?.rotate ?? true ) {
      const rotationMax = p.PI * ( options.sketch?.animation?.rotationCount ?? 2 );

      // Calculate radial rotation for radial mode
      let radialAngle = 0;

      if ( waveConfig.mode === "radial" ) {
        // Calculate angle from center to this position
        const centerX = 0;
        const centerY = 0;

        radialAngle = p.atan2(
          position.y - centerY,
          position.x - centerX
        );

        // Reverse direction if radiating from center
        const fromCenter = waveConfig.fromCenter ?? true;

        if ( fromCenter ) {
          radialAngle += p.PI; // Flip 180 degrees
        }
      }

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
            rotationMax,
            0
          ),
          p.createVector( rotationMax )
        ],
        currentTime: switchIndex,
        duration: 1,
        lerpFn: mappers.lerpVector,
        easingFn: easing.easeInOutExpo
        // easingFn: easing.easeInOutElastic,
        // easingFn: easing.easeInOutCirc,
      } );

      // Apply radial rotation first (around Z axis to point toward/away from center)
      if ( waveConfig.mode === "radial" && ( waveConfig.radialRotation ?? true ) ) {
        sketchState.shape.graphics.rotateZ( radialAngle );
      }

      sketchState.shape.graphics.rotateX( rX );
      sketchState.shape.graphics.rotateY( rY );
    }

    sketchState.shape.graphics.box(
      w,
      h,
      -d
    );

    sketchState.shape.graphics.pop();
  } );

  p.image(
    sketchState.shape.graphics,
    0,
    0
  );
  sketchState.shape.graphics.clear();

  // The cursor overlay: drawn on the 2D canvas, after the 3D buffer has been
  // flattened onto it, so it never joins the scene's depth buffer.
  const waveConfig = options.sketch?.animation?.wave ?? {
    mode: "linear"
  };

  if ( waveConfig.mode === "interactive" && sketchState.interactive.position ) {
    // Draw crosshair
    p.stroke(
      128,
      128,
      255
    );
    p.strokeWeight( 2 );
    p.line(
      sketchState.interactive.position.x,
      0,
      sketchState.interactive.position.x,
      p.height
    );
    p.line(
      0,
      sketchState.interactive.position.y,
      p.width,
      sketchState.interactive.position.y
    );

    // Draw pointer image if not using mouse
    if ( !waveConfig.useMouse ) {
      p.image(
        sketchState.interactive.image,
        sketchState.interactive.position.x,
        sketchState.interactive.position.y
      );
    }
  }
} );
