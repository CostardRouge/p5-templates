import options from "@/p5/utils/options.js";
import events from "@/p5/utils/events.js";
import sketch from "@/p5/utils/sketch.js";
import mediapipe, {
  init as mediapipeInit, interact
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  drawSegmentationMask
} from "@/p5/utils/segmentation.js";

import renderTitle from "@/p5/utils/title/renderTitle.js";

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
    tasks: [
      // "segmenter",
      "interactive"
    ]
  } );
} );

events.register(
  "engine-mouse-pressed",
  () => {
    if ( mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height ) {
      // Map Mouse (Screen) -> Video (Capture)
      // If your canvas is full screen (windowWidth) but video is 320x240,
      // the normalization in `interact()` handles the ratio,
      // but we need to ensure we pass the "Video Relative" pixel or just pass raw
      // and let `interact` normalize based on video size?

      // Actually, `interact` expects pixel coordinates relative to the video element.
      // If we draw the video using `image(video, 0, 0, width, height)`,
      // The scale factor is:
      const scaleX = mediapipe.capture.size.width / width;
      const scaleY = mediapipe.capture.size.height / height;

      const videoX = mouseX * scaleX;
      const videoY = mouseY * scaleY;

      console.log(
        scaleX,
        scaleY,
        videoX,
        videoY
      );

      interact(
        videoX,
        videoY
      );
    }
  }
);

sketch.draw( (
  time, center, favouriteColour
) => {
  background( ...options.sketch.backgroundColor );

  // if ( mediapipe.idle ) background( 90 );

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
        255
      ]
    );
  }

  const interactiveResult = mediapipe.tasks.interactive?.result;

  if ( interactiveResult ) {
    console.log(
      "interactive result",
      interactiveResult
    );

    drawSegmentationMask(
      layers.mask.graphics,
      interactiveResult,
      [
        0,
        255,
        255,
        150
      ]
    );
  }

  // --- 2. Draw Layers ---
  // for ( const layerName in layers ) {
  //   const layer = layers[ layerName ];
  //
  //   // Stretch whatever size the layer is to fill the screen
  //   image(
  //     layer.graphics,
  //     0,
  //     0,
  //     width,
  //     height
  //   );
  //
  //   if ( layer.background ) {
  //     layer.graphics.background( ...layer.background );
  //   }
  //
  //   // Only clear photo layer, mask is self-clearing
  //   if ( layer.erase ) {
  //     layer.graphics.clear();
  //   }
  // }

  image(
    mediapipe.capture.element,
    0,
    0,
    width,
    height
  );

  renderTitle( options.sketch?.title );

  image(
    layers.mask.graphics,
    0,
    0,
    width,
    height
  );
} );