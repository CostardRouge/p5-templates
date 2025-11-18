import options from "../../utils/options.js";
import animation from "../../utils/animation.js";
import mappers from "../../utils/mappers.js";
import easing from "../../utils/easing.js";
import colors from "../../utils/colors.js";
import string from "../../utils/string.js";
import sketch from "../../utils/sketch.js";

const canvases = {
};
let o = options;

sketch.setup( () => {
  canvases.buffer = createGraphics(
    sketch?.engine?.canvas?.width,
    sketch?.engine?.canvas?.height,
    "webgl"
  );

  canvases.pixilated = createGraphics(
    sketch?.engine?.canvas?.width,
    sketch?.engine?.canvas?.height
  );

  canvases.mask = createGraphics(
    sketch?.engine?.canvas?.width,
    sketch?.engine?.canvas?.height
  );

  canvases.pixilated.pixelDensity( 0.06 );
} );

function drawShape( {
  canvas = window, depth = 60, text = "sinewave"
} ) {
  canvas.background( ...( options.sketch.shape.backgroundColor ?? [
    0
  ] ) );
  const canvasFlatDimensionAverage = ( width + height ) / 2;

  const points = animation.ease( {
    values: text.split( "" ).map( text => (
      string.getTextPoints( {
        text,
        position: createVector(
          0,
          0
        ),
        sampleFactor: options.sketch.shape.sampleFactor,
        size: canvasFlatDimensionAverage * options.sketch.shape.sizeRatio,
        simplifyThreshold: options.sketch.shape.simplifyThreshold,
        font: string.fonts?.[ options.sketch.shape.font ?? "sans" ],
      } )
    ) ),
    lerpFn: mappers.lerpPoints,
    currentTime: animation.progression * text.length * options.sketch.shape.morphingSpeed,
    easingFn: easing?.[ options.sketch.shape.morphingEasing ?? "easeInOutExpo" ]
  } );

  canvas.push();

  for ( let z = 0; z < depth; z++ ) {
    const depthProgression = -( z / depth );

    canvas.push();
    canvas.translate(
      0,
      0,
      mappers.fn(
        z,
        0,
        depth,
        options.sketch.shape.depthStart * canvasFlatDimensionAverage,
        options.sketch.shape.depthEnd * canvasFlatDimensionAverage,
        easing.easeInExpo_
      )
    );
    canvas.strokeWeight( options.sketch.shape.pointsStrokeWeight );

    for ( let i = 0; i < points.length; i++ ) {
      // const progression = i / points.length

      const {
        x, y
      } = points[ i ];
      const colorFunction = colors?.[ options.sketch.shape.colorScheme ];

      const opacityFactor = mappers.fn(
        sin(
          depthProgression * 2 * PI,
          easing.easeInOutExpo
        ),
        -1,
        1,
        1.25,
        1
      ) * Math.pow(
        1.3,
        z
      );

      canvas.stroke( colorFunction( {
        hueOffset: (
          // +depthProgression*10
          // +mappers.fn(depthProgression, 0, 1, 0, PI/2, easing.easeInOutExpo)
          +animation.progression
        ),
        // hueIndex: mappers.circularPolar(progression, 0, 1, -PI, PI)*2,
        hueIndex: mappers.fn(
          noise(
            x / width,
            y / height + animation.progression * 1,
            depthProgression / 2
          ),
          0,
          1,
          -PI,
          PI
        ) * 14,
        // hueIndex:mappers.fn(noise(x/width, y/height, progression/2+depthProgression/2), 0, 1, -PI, PI)*10,
        opacityFactor,
        // opacityFactor: map(depthProgression, 0, 1, 1.75, 1) * Math.pow(1.05, z)
      } ) );

      const xx = (
        x * mappers.fn(
          z,
          0,
          depth,
          1,
          0,
          easing.easeInExpo
        )
        + x * Math.pow(
          1.1,
          z
        )
      );

      const yy = (
        y * mappers.fn(
          z,
          0,
          depth,
          1,
          0,
          easing.easeInExpo
        )
        + y * Math.pow(
          1.12,
          z
        )
      );

      canvas.point(
        xx,
        yy
      );
    }
    canvas.pop();
  }
  canvas.pop();
}

function wave(
  canvas = window, step = options.sketch.wave.step
) {
  const values = [
    height * options.sketch.wave.heightStart,
    height * options.sketch.wave.heightEnd,
  ];

  for ( let index = 0; index < 1; index += step ) {
    canvas.vertex(
      ( index ) * width,
      animation.ease( {
        values,
        currentTime: (
          +index * options.sketch.wave.count
          + animation.progression * options.sketch.wave.speed
        ),
        easingFn: easing?.[ options.sketch.wave.easing ?? "easeInOutSine" ]
      } )
    );
  }
}

sketch.draw( (
  _time, _center, favoriteColor
) => {
  noSmooth();

  background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  drawShape( {
    canvas: canvases.buffer,
    depth: options.sketch.shape.depthCount,
    text: options.sketch.shape.text
  } );

  image(
    canvases.buffer,
    0,
    0,
    width,
    height
  );

  canvases.pixilated.image(
    canvases.buffer.get(),
    0,
    0,
    width,
    height
  );

  canvases.mask.erase();
  canvases.mask.rect(
    0,
    0,
    width,
    height
  );
  canvases.mask.noErase();
  canvases.mask.beginShape();

  wave( canvases.mask );

  canvases.mask.vertex(
    width,
    height
  );
  canvases.mask.vertex(
    0,
    height
  );
  canvases.mask.endShape( CLOSE );

  const maskedImage = canvases.pixilated.get();

  maskedImage.mask( canvases.mask );

  image(
    maskedImage,
    0,
    0
  );

  // image(
  //   canvases.pixilated,
  //   0,
  //   0,
  //   width,
  //   height
  // );

  noFill();
  strokeWeight( options.sketch.wave.strokeWeight );
  stroke( options.sketch.wave.stroke ?? favoriteColor );

  beginShape();
  wave( window );
  endShape( options.sketch.wave.close && CLOSE );

  canvases.pixilated.pixelDensity( options.sketch.pixelDensity );
} );