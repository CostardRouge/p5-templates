import {
  sketch, events, mappers, animation, imageUtils, string, captureOptions as options, shapes
} from "/assets/scripts/p5-sketches/utils/index.js";

import "https://unpkg.com/ml5@1/dist/ml5.js";

const trackedHandParts = [
  "thumb_tip",
  "index_finger_tip",
  "middle_finger_tip",
  "ring_finger_tip",
  "pinky_finger_tip",
  "wrist"
];

const _ml5 = {
  capture: {
    element: undefined,
    size: {
      width: 640,
      height: 480,
    }
  },
  webcam: {
    element: undefined,
    size: {
      width: 960,
      height: 720,
    }
  },

  bodySegmentation: undefined,
  handPose: undefined,
  faceMesh: undefined,

  drawing: undefined,

  hands: [
  ],
  faces: [
  ],
  segmentation: undefined,
};

events.register(
  "engine-window-preload",
  () => {
    _ml5.handPose = ml5.handPose( {
      maxHands: 4,
      flipped: true,
      runtime: "tfjs",
      modelType: "full",
    } );

    _ml5.bodySegmentation = ml5.bodySegmentation(
      "BodyPix",
      {
        maskType: "parts"
      }
    );
  // _ml5.faceMesh = ml5.faceMesh();
  }
);

sketch.setup(
  () => {
    background( ...options.colors.background );

    _ml5.drawing = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height
    );

    _ml5.capture.element = createCapture(
      VIDEO,
      {
        flipped: true
      }
    );
    _ml5.capture.element.size(
      _ml5.capture.size.width,
      _ml5.capture.size.height
    );
    _ml5.capture.element.hide();

    _ml5.webcam.element = createCapture(
      VIDEO,
      {
        flipped: true
      }
    );
    _ml5.webcam.element.size(
      _ml5.webcam.size.width,
      _ml5.webcam.size.height
    );
    _ml5.webcam.element.hide();

    // _ml5.handPose.detectStart(_ml5.capture.element, results => {
    // 	_ml5.hands = results;
    // })

    _ml5.bodySegmentation.detectStart(
      _ml5.capture.element,
      results => {
        _ml5.segmentation = results;
      }
    );
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    }
  }
);

function drawHand(
  hand, color, graphics = window
) {
  graphics.beginShape();
  hand.forEach( tip => {
    graphics.vertex(
      map(
        tip.x,
        0,
        _ml5.capture.size.width,
        0,
        _ml5.webcam.size.width
      ),
      map(
        tip.y,
        0,
        _ml5.capture.size.height,
        0,
        _ml5.webcam.size.height
      ),
    );
  } );
  graphics.strokeWeight( 5 );
  graphics.stroke( "white" );
  graphics.fill( color );
  graphics.endShape( CLOSE );
}

sketch.draw( (
  time, center, favoriteColor
) => {
  background(
    ...options.colors.background,
    10
  );

  _ml5.handPose?.detect(
    _ml5.capture.element,
    results => {
      _ml5.hands = results;
    }
  );

  // _ml5.bodySegmentation?.detect(
  //   _ml5.capture.element,
  //   results => {
  //     _ml5.segmentation = results;
  //   }
  // );

  const handFingers = {
  };

  for ( let i = 0; i < _ml5.hands.length; i++ ) {
    const hand = _ml5.hands[ i ];
    const handedness = `${ hand.handedness }-${ i }`;

    handFingers[ handedness ] = handFingers[ handedness ] ?? [
    ];

    trackedHandParts.forEach( trackedHandPart => {
      handFingers[ handedness ].push( createVector(
        // mappers.smoother(`${handedness}-${trackedHandPart}-x`, hand[trackedHandPart].x, 0.35),
        // mappers.smoother(`${handedness}-${trackedHandPart}-y`, hand[trackedHandPart].y, 0.35),
        hand[ trackedHandPart ].x,
        hand[ trackedHandPart ].y,
      ) );
    } );
  }

  for ( const handedness in handFingers ) {
    const eraseMode = handedness.indexOf( "Left" ) !== -1;
    const color = eraseMode ? "red" : "green";

    // eraseMode && _ml5.drawing.erase()
    drawHand(
      handFingers[ handedness ],
      color,
      _ml5.drawing
    );
    // _ml5.drawing.noErase()
  }

  // image(_ml5.webcam.element, 0, 0, _ml5.webcam.size.width, _ml5.webcam.size.height);
  // image(_ml5.drawing, 0, 0, _ml5.webcam.size.width, _ml5.webcam.size.height);

  if ( _ml5.segmentation ) {
    imageUtils.clearColor( _ml5.segmentation.mask );
    // image(_ml5.segmentation.mask, 0, 0, _ml5.webcam.size.width, _ml5.webcam.size.height);

    imageMode( CORNER );
    push();
    translate(
      width,
      0
    );
    scale(
      -1,
      1
    );
    image(
      _ml5.segmentation.mask,
      0,
      0,
      width,
      height
    );
    pop();
  }

  // for (const handedness in handFingers) {
  // 	const isLeft = handedness.indexOf("Left") !== -1;
  // 	const color = isLeft ? "red" : "green";
  //
  // 	drawHand(handFingers[handedness], color)
  // }

  string.write(
    options.name.replaceAll(
      "-",
      "\n"
    ),
    0,
    height * .2,
    {
      size: 92,
      stroke: color( ...options.colors.background ),
      fill: color(
        ...options.colors.text,
        190
      ),
      font: string.fonts.martian,
      textWidth: width,
      textAlign: [
        CENTER
      ],
    }
  );
} );
