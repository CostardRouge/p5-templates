import options from "@/p5/utils/options.js";
import events from "@/p5/utils/events.js";
import sketch from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import mediapipe, {
  init as mediapipeInit, interact
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  drawSegmentationMask
} from "@/p5/utils/segmentation.js";

import * as common from "@/p5/utils/common.js";

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
    enableCapture: false, // No camera needed for image-based interactive segmentation
    tasks: [
      // "segmenter",
      "interactive"
    ]
  } );
} );

events.register(
  "engine-mouse-pressed",
  () => {
    const photo = common.getAsset( options.sketch?.photo?.image );
    
    if ( !photo ) return;
    
    if ( mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height ) {
      // Get the underlying canvas element from p5.Image
      const imageElement = photo.img.canvas || photo.img.elt || photo.img;
      
      // Map Mouse (Screen) -> Photo (Image)
      // Scale from canvas coordinates to image coordinates
      const scaleX = photo.img.width / width;
      const scaleY = photo.img.height / height;

      const imageX = mouseX * scaleX;
      const imageY = mouseY * scaleY;

      console.log(
        "Click at canvas:",
        mouseX,
        mouseY,
        "-> image:",
        imageX,
        imageY,
        "element:",
        imageElement
      );

      console.log("interact")

      interact(
        imageX,
        imageY,
        imageElement
      );
    }
  }
);

sketch.draw( () => {
  background( ...options.sketch.backgroundColor );

  const photo = common.getAsset( options.sketch?.photo?.image );
  
  if ( !photo ) {
    frameRate(1)
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
        ]
      }
    );
    return
  }
  else {
    frameRate(options.animation.framerate)
    image(
      photo.img,
      0,
      0,
      width,
      height
    );
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

  if ( interactiveResult ) {

    // console.log("interactiveResult", interactiveResult)

    const {
      data, width: maskWidth, height: maskHeight
    } = interactiveResult;

    // Resize mask graphics if needed
    if ( layers.mask.graphics.width !== maskWidth || layers.mask.graphics.height !== maskHeight ) {
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
      true
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

  // image(
  //   mediapipe.capture.element,
  //   0,
  //   0,
  //   width,
  //   height
  // );

  // Display mask overlay if available
  if ( interactiveResult ) {
    string.write(
      "TEXT BETWEEN PHOTO AND DETECTED MASK",
      0,
      0,
      {
        size: 144,
        stroke: color( 0, 0, 0, 0 ),
        fill: color( 255 ),
        textHeight: height,
        font: string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ]
      }
    );

    const maskedImage = photo.img.get();

    maskedImage.mask( layers.mask.graphics );

    image(
      maskedImage,
      0,
      0,
      width,
      height
    );
  }

  // renderTitle( options.sketch?.title );
} );