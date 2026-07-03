import cache from "@/p5/utils/cache.js";
import easing from "@/p5/utils/easing.js";
import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import graphics from "@/p5/utils/graphics.js";
import * as common from "@/p5/utils/common.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import mediapipe from "@/p5/utils/mediapipe/mediapipe.js";
import {
  initInteraction,
  getPointers
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";

const sketchState = {
  plane: {
    graphics: null,
    gridData: null
  },
  webcam: {
    graphics: null
  }
};

sketch.setup( async() => {
  const p = getP5();

  p.background( ...getBackgroundColor() );
  p.pixelDensity( 1 );

  sketchState.plane.graphics = graphics.createAutoResizableGraphics(
    p.width,
    p.height,
    "webgl"
  );
  sketchState.plane.graphics.pixelDensity( 1 );

  sketchState.webcam.graphics = p.createGraphics(
    p.width,
    p.height
  );

  // One call boots every enabled interaction source (mouse, vision, orbit…)
  // declared in the shared `interaction` options.
  await initInteraction( options.sketch?.interaction ?? {} );
} );

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    246,
    235,
    225
  ];

// Interaction pointers arrive in top-left canvas space; the plane lives in
// centered WEBGL model space, so shift each pointer by half the canvas. This
// replaces the old per-source screenPosition round-trip (≈ identity at the base
// camera) with a deterministic, camera-independent conversion.
const toModelSpace = ( pointers ) => {
  const p = getP5();

  return pointers.map( ( v ) =>
    p.createVector(
      v.x - p.width / 2,
      v.y - p.height / 2
    ) );
};

// Creates a grid of triangle vertices
// Returns an immutable data structure containing all vertex information
function createTriangleGrid(
  columns, rows, totalWidth, totalHeight
) {
  const cellWidth = totalWidth / columns;
  const cellHeight = totalHeight / rows;
  const halfWidth = totalWidth / 2;
  const halfHeight = totalHeight / 2;

  const vertices = [];

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
  const p = getP5();

  if ( imageTexture && imageTexture.width && imageTexture.height ) {
    sketchState.plane.graphics.texture( imageTexture );
  }

  const maxInfluenceDistance =
    options.sketch.animation.maxInfluenceDistance ?? 150;

  // Render each triangle
  grid.vertices.forEach( ( {
    triangle
  } ) => {
    sketchState.plane.graphics.beginShape( p.TRIANGLES );

    triangle.forEach( ( _vertex ) => {
      // mouse displacement
      const switchIndex = computeDisplacement(
        p.createVector(
          _vertex.x,
          _vertex.y
        ),
        targetVectors,
        maxInfluenceDistance
      );

      const z =
        _vertex.z +
        animation.ease( {
          values: [
            0,
            options.sketch?.animation?.depth
          ],
          currentTime: switchIndex,
          easingFn:
            easing?.[ options.sketch.animation.easing ] ?? easing.easeOutBack
        } );

      const vertices = [
        _vertex.x,
        _vertex.y,
        z
      ];

      if ( imageTexture && imageTexture.width && imageTexture.height ) {
        // Flip U coordinate horizontally when using webcam to correct mirroring
        const u = options.sketch.texture.useWebcam ? _vertex.u : _vertex.u;

        vertices.push(
          u * imageTexture.width,
          _vertex.v * imageTexture.height
        );
      }

      sketchState.plane.graphics.vertex( ...vertices );
    } );

    if ( options.sketch.grid.stroke.hide ) {
      sketchState.plane.graphics.noStroke();
    } else {
      sketchState.plane.graphics.stroke( ...options.sketch.grid.stroke.color );
    }
    sketchState.plane.graphics.endShape();
  } );

  sketchState.plane.graphics.reset();
}

function computeDisplacement(
  position, targetVectors, maxInfluenceDistance
) {
  const p = getP5();

  let minDistance = Infinity;

  for ( let i = 0; i < targetVectors.length; i++ ) {
    const target = targetVectors[ i ];
    const distance = position.dist( target );

    if ( distance < minDistance ) {
      minDistance = distance;
    }
  }

  const proximity = p.map(
    minDistance,
    0,
    maxInfluenceDistance,
    1,
    0
  );

  // Ensure the value is clamped between 0 and 1
  return p.constrain(
    proximity,
    0,
    1
  );
}

sketch.draw( () => {
  const p = getP5();
  const interaction = options.sketch?.interaction ?? {};

  p.clear();
  p.background( ...getBackgroundColor() );

  sketchState.plane.gridData = cache.store(
    cache.key(
      options.sketch.grid.columns,
      options.sketch.grid.rows,
      sketchState.plane.graphics.width,
      sketchState.plane.graphics.height
    ),
    () =>
      createTriangleGrid(
        options.sketch.grid.columns,
        options.sketch.grid.rows,
        sketchState.plane.graphics.width,
        sketchState.plane.graphics.height
      )
  );

  const _image = options.sketch.texture.useWebcam
    ? mediapipe.capture.element
    : common.getAsset( options.sketch?.texture.image )?.img;

  // Every enabled source — mouse, hands, orbit, … — merged into one flat list
  // and mapped into the plane's centered coordinate space.
  const targetVectors = toModelSpace( getPointers( interaction ) );

  displayTriangleGrid(
    sketchState.plane.gridData,
    targetVectors,
    _image
  );

  if ( options.sketch.animation.showSpheres ?? true ) {
    targetVectors.forEach( ( vector ) => {
      sketchState.plane.graphics.push();
      sketchState.plane.graphics.translate(
        vector.x,
        vector.y,
        50
      );
      sketchState.plane.graphics.sphere( options.sketch.animation.sphereSize ?? 30 );
      sketchState.plane.graphics.pop();
    } );
  }

  // PLANE

  p.image(
    sketchState.plane.graphics,
    0,
    0
  );
  sketchState.plane.graphics.clear();
  sketchState.plane.graphics.reset();

  // WEBCAM - only render if enabled and capture element exists
  if (
    mediapipe.enabled &&
    mediapipe.capture.element &&
    options.sketch.animation.showWebcam
  ) {
    sketchState.webcam.graphics.clear();
    sketchState.webcam.graphics.image(
      mediapipe.capture.element,
      0,
      0,
      mediapipe.capture.size.width * 2,
      mediapipe.capture.size.height * 2
    );
    p.image(
      sketchState.webcam.graphics,
      0,
      0,
      p.width,
      p.height
    );
  }

  renderTitle( options.sketch?.title );

  // Shared debug/demo overlay (crosshairs, markers, camera preview, legend),
  // gated by `interaction.visualization` — off by default so the 3D scene
  // stays clean, but available from the form.
  drawInteractionOverlay( interaction );
} );
