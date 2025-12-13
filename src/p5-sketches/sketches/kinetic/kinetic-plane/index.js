import easing from "@/p5/utils/easing.js";
import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import graphics from "@/p5/utils/graphics.js";
import * as common from "@/p5/utils/common.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import addScreenPositionFunction from "@/public/assets/libraries/addScreenPositionFunction.js";

import mediapipe, {
  init as mediapipeInit, setEnabled as setMediapipeEnabled
} from "@/p5/utils/mediapipe/mediapipe.js";

// Key landmarks for interaction (fingertips)
const interactionIndices = [
  4,
  8,
  12,
  16,
  20
];

const sketchState = {
  interactive: {
    image: null,
  },
  plane: {
    graphics: null,
    gridData: null
  },
  webcam: {
    graphics: null,
  }
};

function createGridData(
  width, height
) {
  sketchState.plane.gridData = createTriangleGrid(
    options.sketch.grid.columns,
    options.sketch.grid.rows,
    width,
    height
  );
}

sketch.setup( async( {
  canvas
} ) => {
  background( ...getBackgroundColor() );
  pixelDensity( 1 );

  sketchState.plane.graphics = graphics.createAutoResizableGraphics(
    width,
    height,
    "webgl",
    createGridData
  );
  addScreenPositionFunction( sketchState.plane.graphics );

  createGridData(
    width,
    height,
  );

  sketchState.webcam.graphics = createGraphics(
    width,
    height
  );

  await mediapipeInit( {
    worker: false,
    tasks: [
      "hands"
    ]
  } );
} );

const getBackgroundColor = () =>
  ( options.sketch?.backgroundColor ??
  [
    246,
    235,
    225
  ] );

// Creates a grid of triangle vertices
// Returns an immutable data structure containing all vertex information
function createTriangleGrid(
  columns, rows, totalWidth, totalHeight
) {
  const cellWidth = totalWidth / columns;
  const cellHeight = totalHeight / rows;
  const halfWidth = totalWidth / 2;
  const halfHeight = totalHeight / 2;

  const vertices = [
  ];

  for ( let row = 0; row < rows; row++ ) {
    for ( let column = 0; column < columns; column++ ) {
      const x = column * cellWidth - halfWidth;
      const y = row * cellHeight - halfHeight;

      // Calculate UV coordinates (texture coordinates from 0 to 1)
      const u0 = column / columns;
      const v0 = row / rows;
      const u1 = ( column + 1 ) / columns;
      const v1 = ( row + 1 ) / rows;

      // Each cell contains two triangles
      // Triangle 1: top-left half
      vertices.push( {
        triangle: [
          {
            x: x,
            y: y,
            z: 0,
            u: u0,
            v: v0
          },
          {
            x: x + cellWidth,
            y: y,
            z: 0,
            u: u1,
            v: v0
          },
          {
            x: x,
            y: y + cellHeight,
            z: 0,
            u: u0,
            v: v1
          }
        ]
      } );

      // Triangle 2: bottom-right half
      vertices.push( {
        triangle: [
          {
            x: x + cellWidth,
            y: y,
            z: 0,
            u: u1,
            v: v0
          },
          {
            x: x + cellWidth,
            y: y + cellHeight,
            z: 0,
            u: u1,
            v: v1
          },
          {
            x: x,
            y: y + cellHeight,
            z: 0,
            u: u0,
            v: v1
          }
        ]
      } );
    }
  }

  return {
    vertices,
    columns,
    rows,
    cellWidth,
    cellHeight
  };
}

// Displays the triangle grid with optional image texture
// Pure function - doesn't modify any external state
function displayTriangleGrid(
  grid, targetVectors, imageTexture
) {
  if ( imageTexture && imageTexture.width && imageTexture.height ) {
    sketchState.plane.graphics.texture( imageTexture );
  }

  const maxInfluenceDistance = options.sketch.animation.maxInfluenceDistance ?? 150;

  // Render each triangle
  grid.vertices.forEach( ( {
    triangle
  } ) => {
    sketchState.plane.graphics.beginShape( TRIANGLES );

    triangle.forEach( _vertex => {
      const wave = 0;

      //   map(
      //   Math.sin( animation.angle +
      //     ( _vertex.x / width ) * 3 +
      //     ( _vertex.y / height ) * 2 ),
      //   -1,
      //   1,
      //   0,
      //   900
      // );

      // mouse displacement
      const switchIndex = computeDisplacement(
        createVector(
          _vertex.x,
          _vertex.y,
        ),
        targetVectors,
        maxInfluenceDistance
      );

      const z = _vertex.z + animation.ease( {
        values: [
          0,
          options.sketch?.animation?.depth,
        ],
        currentTime: switchIndex,
        easingFn: easing?.[ options.sketch.animation.easing ] ?? easing.easeOutBack,
      } );

      const vertices = [
        _vertex.x,
        _vertex.y,
        z,
      ];

      if ( imageTexture && imageTexture.width && imageTexture.height ) {
        vertices.push(
          _vertex.u * imageTexture.width,
          _vertex.v * imageTexture.height
        );
      }

      sketchState.plane.graphics.vertex( ...vertices );
    } );

    // strokeWeight(3)
    // stroke("red")
    // noFill();

    sketchState.plane.graphics.noStroke();
    // sketchState.plane.graphics.noFill();
    sketchState.plane.graphics.endShape();
  } );
}

function computeDisplacement(
  position, targetVectors, maxInfluenceDistance
) {
  let minDistance = Infinity;

  for ( let i = 0; i < targetVectors.length; i++ ) {
    const target = targetVectors[ i ];
    const distance = position.dist( target );

    if ( distance < minDistance ) {
      minDistance = distance;
    }
  }

  const proximity = map(
    minDistance,
    0,
    maxInfluenceDistance,
    1,
    0
  );

  // Ensure the value is clamped between 0 and 1
  return constrain(
    proximity,
    0,
    1
  );
}

sketch.draw( () => {
  background( ...getBackgroundColor() );

  // Dynamically enable/disable mediapipe based on useHands option
  const useHands = options.sketch.animation.useHands ?? true;

  setMediapipeEnabled( useHands );

  const _image = common.getAsset( options.sketch?.image );

  const targetVectors = [

  ];

  if ( options.sketch.animation.useMouse ?? true ) {
    sketchState.plane.graphics.screenPosition( createVector(
      mouseX - width / 2,
      mouseY - height / 2,
    ) );
  }

  if ( options.sketch.animation.useHands ?? true ) {
    mediapipe.tasks?.hands?.result?.landmarks?.forEach( hand => {
      const interactionPoints = interactionIndices.map( i => hand[ i ] ).filter( Boolean );

      interactionPoints.forEach( point => {
        if ( point ) {
          const x = common.inverseX( point.x ) * width;
          const y = point.y * height;
          const z = point.z * ( width + height ) / 2;

          targetVectors.push( sketchState.plane.graphics.screenPosition( createVector(
            x - width / 2,
            y - height / 2,
            z - ( width / 2 ) + ( height / 2 ),
          ) ) );
        }
      } );
    } );
  }

  const margin = 150;
  const W = width / 2 - margin;
  const H = height / 2 - margin;
  const targetsCount = options.sketch.animation.spheresCount ?? 3;

  for ( let i = 0; i < targetsCount; i++ ) {
    const targetProgression = i / targetsCount;

    targetVectors.push( sketchState.plane.graphics.screenPosition( createVector(
      Math.sin( animation.angle + i * 2 ) * W,
      Math.cos( animation.angle + i * targetProgression ) * H
    ) ) );
  }

  displayTriangleGrid(
    sketchState.plane.gridData,
    targetVectors,
    _image?.img
  );

  if ( options.sketch.animation.showSpheres ?? true ) {
    targetVectors.forEach( ( vector ) => {
      sketchState.plane.graphics.push();
      sketchState.plane.graphics.translate(
        vector.x,
        vector.y,
        50
      );
      sketchState.plane.graphics.normalMaterial( vector );
      sketchState.plane.graphics.sphere( options.sketch.animation.sphereSize ?? 30 );
      sketchState.plane.graphics.pop();
    } );
  }

  // PLANE
  image(
    sketchState.plane.graphics,
    0,
    0
  );
  sketchState.plane.graphics.clear();

  // WEBCAM - only render if enabled and capture element exists
  if ( mediapipe.enabled && mediapipe.capture.element && options.sketch.animation.showWebcam ) {
    sketchState.webcam.graphics.clear();
    sketchState.webcam.graphics.image(
      mediapipe.capture.element,
      0,
      0,
      mediapipe.capture.size.width * 2,
      mediapipe.capture.size.height * 2
    );
    // sketchState.webcam.graphics.filter( POSTERIZE );
    // sketchState.webcam.graphics.filter( INVERT );
    // sketchState.webcam.graphics.filter( GRAY );
    image(
      sketchState.webcam.graphics,
      0,
      0,
      width,
      height
    );
  }

  renderTitle( options.sketch?.title );
} );
