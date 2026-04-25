import options from "@/p5/utils/options.js";
import events from "@/p5/utils/events.js";
import sketch from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import mediapipe, {
  init as mediapipeInit,
  interact,
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  drawSegmentationMask
} from "@/p5/utils/segmentation.js";

import * as common from "@/p5/utils/common.js";

import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  setSketchOptions,
  subscribeSketchOptions,
} from "@/p5/shared/syncSketchOptions.js";

const layers = {
  photo: {
    graphics: undefined,
    size: options.size,
    background: [
      80
    ],
    erase: 255,
  },
  mask: {
    graphics: undefined,
    // Initialize with a default, but we will resize this dynamically!
    size: {
      width: 1,
      height: 1,
    },
    background: undefined,
    erase: false,
  },
};

// Cache for performance optimization
const cache = {
  currentImagePath: null,
  maskedImage: null,
  interactiveResultProcessed: false,
  lastInverseValue: null,
  // Track photo display bounds for accurate coordinate mapping
  photoBounds: {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  },
};

sketch.setup( async() => {
  background( ...options.sketch.backgroundColor );

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
    worker: false,
    enableCapture: false, // No camera needed for image-based interactive segmentation
    tasks: [
      // "segmenter",
      "interactive",
    ],
  } );

  // Subscribe to option changes
  subscribeSketchOptions( (
    newOptions, origin
  ) => {
    // Only react to changes from React (user editing settings)
    if ( origin !== "react" ) return;

    const currentImagePath = newOptions.sketch?.photo?.image;
    const currentInverse = newOptions.sketch?.segmentation?.inverse;

    // Clear cache if image changed
    if ( cache.currentImagePath !== currentImagePath ) {
      cache.currentImagePath = currentImagePath;
      cache.maskedImage = null;
      cache.interactiveResultProcessed = false;
      cache.lastInverseValue = currentInverse;

      console.log( "Image changed, cache cleared" );

      return;
    }

    // Check if inverse parameter changed
    if ( cache.lastInverseValue !== currentInverse ) {
      cache.lastInverseValue = currentInverse;
      cache.maskedImage = null;
      cache.interactiveResultProcessed = false;

      console.log( "Inverse parameter changed, recalculating mask" );

      // Re-trigger segmentation if ROI exists
      if ( newOptions.sketch?.segmentation?.roi ) {
        triggerSegmentation();
      }

      return;
    }

    // Re-trigger segmentation if ROI exists and hasn't been processed yet
    if (
      newOptions.sketch?.segmentation?.roi &&
      !cache.interactiveResultProcessed
    ) {
      console.log( "Options changed, re-triggering segmentation" );
      triggerSegmentation();
    }
  } );

  // Initialize cache values
  cache.currentImagePath = options.sketch?.photo?.image;
  cache.lastInverseValue = options.sketch?.segmentation?.inverse;

  // Trigger segmentation on startup if ROI already exists
  if ( options.sketch?.segmentation?.roi ) {
    triggerSegmentation();
  }
} );

// Helper function to trigger segmentation
function triggerSegmentation() {
  const photo = common.getAsset( options.sketch?.photo?.image );
  const roi = options.sketch?.segmentation?.roi;

  if ( !photo || !roi ) return;

  // Get the underlying canvas element from p5.Image
  const imageElement = photo.img.canvas || photo.img.elt || photo.img;

  // ROI is already in normalized coordinates (0-1)
  // Convert to image pixel coordinates for interact function
  const imageX = roi.x * photo.img.width;
  const imageY = roi.y * photo.img.height;

  console.log(
    "Triggering segmentation at ROI:",
    roi,
    "-> image coords:",
    imageX,
    imageY
  );

  // Reset the processed flag to allow new result
  cache.interactiveResultProcessed = false;

  interact(
    imageX,
    imageY,
    imageElement
  );
}

// Handle canvas click for segmentation (ignores drag events automatically)
events.register(
  "engine-canvas-mouse-pressed",
  () => {
    const photo = common.getAsset( options.sketch?.photo?.image );

    if ( !photo ) return;

    // Check if click is within photo bounds
    const {
      x: photoX, y: photoY, w: photoW, h: photoH
    } = cache.photoBounds;

    if (
      mouseX < photoX ||
    mouseX > photoX + photoW ||
    mouseY < photoY ||
    mouseY > photoY + photoH
    ) {
      console.log( "Click outside photo bounds" );
      return;
    }

    // Get the underlying canvas element from p5.Image
    const imageElement = photo.img.canvas || photo.img.elt || photo.img;

    // Map Mouse (Canvas) -> Photo Display (with margins/scale) -> Original Image
    const relativeX = mouseX - photoX;
    const relativeY = mouseY - photoY;

    // Scale from displayed photo to original image dimensions
    const scaleX = photo.img.width / photoW;
    const scaleY = photo.img.height / photoH;

    const imageX = relativeX * scaleX;
    const imageY = relativeY * scaleY;

    // Calculate normalized coordinates (0-1) for storage
    const normalizedX = imageX / photo.img.width;
    const normalizedY = imageY / photo.img.height;

    console.log(
      "Click at canvas:",
      mouseX,
      mouseY,
      "-> photo bounds:",
      relativeX,
      relativeY,
      "-> image:",
      imageX,
      imageY,
      "-> normalized:",
      normalizedX,
      normalizedY
    );

    // Save ROI to options
    setSketchOptions( {
      ...options,
      sketch: {
        ...options.sketch,
        segmentation: {
          ...options.sketch?.segmentation,
          roi: {
            x: normalizedX,
            y: normalizedY,
          },
        },
      },
    } );

    // Reset the processed flag to allow new result
    cache.interactiveResultProcessed = false;

    interact(
      imageX,
      imageY,
      imageElement
    );
  }
);

sketch.draw( (
  _, center
) => {
  background( ...options.sketch.backgroundColor );

  const photo = common.getAsset( options.sketch?.photo?.image );

  if ( !photo ) {
    frameRate( 1 );
    string.write(
      "add a photo :)",
      0,
      0,
      {
        size: 72,
        stroke: color( 255 ),
        fill: color( 0 ),
        textHeight: height,
        font: string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ],
      }
    );
    return;
  } else {
    frameRate( options.animation.framerate );

    // Draw photo and capture its bounds for coordinate mapping
    imageUtils.marginImage( {
      img: photo.img,
      position: center,
      margin: width * options.sketch?.photo?.margin,
      scale: options.sketch?.photo?.scale ?? 1,
      center: options.sketch?.photo?.center ?? true,
      clip: options.sketch?.photo?.clip ?? false,
      fill: options.sketch?.photo?.fill ?? true,
      callback: (
        x, y, w, h
      ) => {
        // Store photo bounds for click detection
        cache.photoBounds.x = x;
        cache.photoBounds.y = y;
        cache.photoBounds.w = w;
        cache.photoBounds.h = h;
      },
    } );
  }

  // if ( mediapipe.idle ) background( 90 );

  // --- 1. Mask Logic ---
  // const segmenterResult = mediapipe.tasks.segmenter?.result ?? null;

  // if ( segmenterResult ) {
  //   // Extract strict dimensions from the result
  //   const {
  //     data, width: maskWidth, height: maskHeight
  //   } = segmenterResult;

  //   // Resize graphics if model output size changes (e.g. 256x256 vs 144x256)
  //   if ( layers.mask.graphics.width !== maskWidth || layers.mask.graphics.height !== maskHeight ) {
  //     layers.mask.graphics.resizeCanvas(
  //       maskWidth,
  //       maskHeight
  //     );
  //     // Critical: Reset density for pixel manipulation
  //     layers.mask.graphics.pixelDensity( 1 );
  //   }

  //   drawSegmentationMask(
  //     layers.mask.graphics,
  //     data,
  //     [
  //       255,
  //       0,
  //       0,
  //       255
  //     ]
  //   );
  // }

  const interactiveResult = mediapipe.tasks.interactive?.result;

  if ( interactiveResult && !cache.interactiveResultProcessed ) {
    const {
      data, width: maskWidth, height: maskHeight
    } = interactiveResult;

    // Resize mask graphics if needed
    if (
      layers.mask.graphics.width !== maskWidth ||
      layers.mask.graphics.height !== maskHeight
    ) {
      layers.mask.graphics.resizeCanvas(
        maskWidth,
        maskHeight
      );
      layers.mask.graphics.pixelDensity( 1 );
    }

    drawSegmentationMask(
      layers.mask.graphics,
      data,
      [
        0,
        0,
        0,
        255
      ],
      options.sketch.segmentation.inverse ?? true
    );

    // Create and cache the masked image
    cache.maskedImage = photo.img.get();
    cache.maskedImage.mask( layers.mask.graphics );

    // Mark as processed so we only do this once
    cache.interactiveResultProcessed = true;

    console.log( "Segmentation result processed and cached" );
  }

  renderTitle( options.sketch?.title );

  // Display masked image if available
  if ( cache.maskedImage ) {
    imageUtils.marginImage( {
      img: cache.maskedImage,
      position: center,
      margin: width * options.sketch?.photo?.margin,
      scale: options.sketch?.photo?.scale ?? 1,
      center: options.sketch?.photo?.center ?? true,
      clip: options.sketch?.photo?.clip ?? false,
      fill: options.sketch?.photo?.fill ?? true,
      callback: (
        x, y, w, h
      ) => {
        // Update photo bounds even when showing masked image
        cache.photoBounds.x = x;
        cache.photoBounds.y = y;
        cache.photoBounds.w = w;
        cache.photoBounds.h = h;
      },
    } );
  }
} );
