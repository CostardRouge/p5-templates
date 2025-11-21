"use client";

import options from "../../utils/options.js";
import string from "../../utils/string.js";
import sketch from "../../utils/sketch.js";
import mediapipe, {
  init as mediapipeInit
} from "../../utils/mediapipe/mediapipe.js";
import {
  drawSegmentationMask
} from "../../utils/segmentation.js";

const layers = {
  photo: {
    graphics: undefined,
    size: options.size,
    background: [
      80
    ],
    erase: 255
  },
  mask: {
    graphics: undefined,
    // Initialize with a default, but we will resize this dynamically!
    size: {
      width: 1,
      height: 1
    },
    background: undefined,
    erase: false
  },
};

sketch.setup( async() => {
  background( ...options.colors.background );

  for ( const layerName in layers ) {
    const {
      background, size
    } = layers[ layerName ];

    layers[ layerName ].graphics = createGraphics(
      size.width,
      size.height
    );
    if ( background ) layers[ layerName ].graphics.background( ...background );
  }

  await mediapipeInit( {
    enableIdle: false,
    worker: false, // Switch to true to test your optimized worker!
    tasks: [
      "segmenter"
    ]
  } );
} );

sketch.draw( (
  time, center, favouriteColour
) => {
  background( ...options.colors.background );

  if ( mediapipe.idle ) background( 90 );

  // --- 1. Mask Logic ---
  const segmenterResult = mediapipe.tasks.segmenter?.result ?? null;

  if ( segmenterResult ) {
    // Extract strict dimensions from the result
    const {
      data, width: maskWidth, height: maskHeight
    } = segmenterResult;

    // Resize graphics if model output size changes (e.g. 256x256 vs 144x256)
    if ( layers.mask.graphics.width !== maskWidth || layers.mask.graphics.height !== maskHeight ) {
      layers.mask.graphics.resizeCanvas(
        maskWidth,
        maskHeight
      );
      // Critical: Reset density for pixel manipulation
      layers.mask.graphics.pixelDensity( 1 );
    }

    drawSegmentationMask(
      layers.mask.graphics,
      data,
      [
        255,
        0,
        0,
        150
      ] // Red
    );
  }

  // --- 2. Draw Layers ---
  for ( const layerName in layers ) {
    const layer = layers[ layerName ];

    // Stretch whatever size the layer is to fill the screen
    image(
      layer.graphics,
      0,
      0,
      width,
      height
    );

    if ( layer.background ) layer.graphics.background( ...layer.background );

    // Only clear photo layer, mask is self-clearing
    if ( layer.erase && layerName !== "mask" ) layer.graphics.clear();
  }

  // ... Text Logic ...
  string.write(
    "segmenter",
    0,
    height / 2,
    {
      size: 128,
      strokeWeight: 0,
      stroke: color( ...options.colors.background ),
      fill: color( ...options.colors.background ),
      font: string.fonts.martian,
      textAlign: [
        CENTER,
        CENTER
      ],
      blendMode: EXCLUSION
    }
  );
} );