import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";

let o = options;

const sketchState = {
  threeDimensionGraphics: null
};

sketch.setup(
  ( {
    canvas
  } ) => {
    sketchState.threeDimensionGraphics = createGraphics(
      width,
      height,
      "webgl"
    );
  },
  {
  }
);

function cross(
  {
    x, y, z
  }, size
) {
  line(
    x - size / 2,
    y - size / 2,
    z,
    x + size / 2,
    y + size / 2,
    z
  );
  line(
    x + size / 2,
    y - size / 2,
    z,
    x - size / 2,
    y + size / 2,
    z
  );
}

function drawProgression(
  progression, start, end
) {
  push();
  stroke(
    128,
    128,
    255
  );
  strokeWeight( 5 );
  cross(
    start,
    20
  );
  cross(
    end,
    20
  );

  const currentProgression = p5.Vector.lerp(
    start,
    end,
    progression
  );

  strokeWeight( 3.5 );
  line(
    start.x,
    start.y,
    start.z,
    currentProgression.x,
    currentProgression.y,
    currentProgression.z
  );
  pop();
}

sketch.draw( (
  time, center
) => {
  background( 0 );

  const W = width / 2;
  const H = height / 2;

  const xProgression = mappers.fn(
    sin( time ),
    -1,
    1,
    0,
    1,
    easing.easeInOutExpo
  );
  const yProgression = mappers.fn(
    cos( time ),
    -1,
    1,
    0,
    1,
    easing.easeInOutExpo
  );
  const zProgression = mappers.fn(
    sin( time + time ),
    -1,
    1,
    0,
    1,
    easing.easeInOutExpo
  );

  // const xProgression = map(
  //   winMouseX,
  //   0,
  //   width,
  //   0,
  //   1
  // );
  // const yProgression = map(
  //   winMouseY,
  //   0,
  //   height,
  //   0,
  //   1
  // );

  const margin = 100;

  drawProgression(
    xProgression,
    createVector(
      -W + margin,
      H - margin
    ),
    createVector(
      W - margin,
      H - margin
    )
  );
  drawProgression(
    yProgression,
    createVector(
      -W + margin,
      H - margin
    ),
    createVector(
      -W + margin,
      -H + margin
    )
  );
  // drawProgression(zProgression, createVector(-W+margin, H-margin), createVector(-W+margin, H-margin, -H) )

  const size = width / 2;
  const font = string.fonts.serif;

  const sampleFactor = 0.05;
  const simplifyThreshold = 0;
  const letterPosition = createVector(
    0,
    0
  );

  const aA = animation.ease( {
    values: [
      string.getTextPoints( {
        text: "a",
        position: letterPosition,
        size,
        font,
        sampleFactor,
        simplifyThreshold
      } ),
      string.getTextPoints( {
        text: "A",
        position: letterPosition,
        size,
        font,
        sampleFactor,
        simplifyThreshold
      } )
    ],
    currentTime: xProgression,
    lerpFn: mappers.lerpPoints
  } );

  const zZ = animation.ease( {
    values: [
      string.getTextPoints( {
        text: "z",
        position: letterPosition,
        size,
        font,
        sampleFactor,
        simplifyThreshold
      } ),
      string.getTextPoints( {
        text: "Z",
        position: letterPosition,
        size,
        font,
        sampleFactor,
        simplifyThreshold
      } )
    ],
    currentTime: xProgression,
    lerpFn: mappers.lerpPoints
  } );

  const points = animation.ease( {
    values: [
      aA,
      zZ
    ],
    lerpFn: mappers.lerpPoints,
    currentTime: yProgression,
  } );

  sketchState.threeDimensionGraphics.push();

  const depth = 200 / 4;

  for ( let z = 0; z < depth; z++ ) {
    const depthProgression = -( z / depth );

    sketchState.threeDimensionGraphics.push();
    sketchState.threeDimensionGraphics.translate(
      0,
      0,
      map(
        z,
        0,
        depth,
        0,
        -500
      )
    );
    // translate( 0, 0, mappers.fn(depthProgression, 0, 1, -500, -1500, easing.easeInOutExpo) )

    sketchState.threeDimensionGraphics.strokeWeight( map(
      z,
      0,
      depth,
      20,
      3
    ) );

    for ( let i = 0; i < points.length; i++ ) {
      const progression = i / points.length;

      const {
        x, y
      } = points[ i ];
      const colorFunction = colors.rainbow;
      const opacityFactor = mappers.fn(
        sin(
          depthProgression * 20 + progression * 50 + time * 2,
          easing.easeInOutExpo
        ),
        -1,
        1,
        5,
        1
      ) * Math.pow(
        1.05,
        z
      );

      if ( opacityFactor > 8 ) {
        // continue;
      }

      sketchState.threeDimensionGraphics.stroke( colorFunction( {
        hueOffset: (
          // +depthProgression*10
          // +mappers.fn(depthProgression, 0, 1, 0, PI/2, easing.easeInOutExpo)
          // +time
          +0
        ),
        // hueIndex: mappers.circularPolar(progression, 0, 1, -PI, PI)*2,
        hueIndex: mappers.fn(
          noise(
            x / width,
            y / height,
            progression / 2 + depthProgression / 2 + time / 16
          ),
          0,
          1,
          -PI,
          PI
        ) * 10,
        // hueIndex:mappers.fn(noise(x/width, y/height, progression/2+depthProgression/2), 0, 1, -PI, PI)*10,
        opacityFactor,
        // opacityFactor: map(depthProgression, 0, 1, 3, 1) * Math.pow(1.05, z)
      } ) );

      const xx = (
        x * mappers.fn(
          z,
          0,
          depth,
          1,
          -1,
          easing.s
        )
        + x
      );

      const yy = (
        y * mappers.fn(
          z,
          0,
          depth,
          1,
          -1,
          easing.s
        )
        + y
      );

      sketchState.threeDimensionGraphics.point(
        xx,
        yy
      );
    }
    sketchState.threeDimensionGraphics.pop();
  }
  sketchState.threeDimensionGraphics.pop();

  image(
    sketchState.threeDimensionGraphics,
    0,
    0
  );
  sketchState.threeDimensionGraphics.clear();
} );