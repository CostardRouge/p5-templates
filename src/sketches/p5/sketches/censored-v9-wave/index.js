import options from "@/p5/utils/options.js";
import animation from "@/p5/utils/animation.js";
import mappers from "@/p5/utils/mappers.js";
import easing from "@/p5/utils/easing.js";
import colors from "@/p5/utils/colors.js";
import string from "@/p5/utils/string.js";
import sketch from "@/p5/utils/sketch.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const canvases = sketch.state( () => ( {} ) );
let o = options;

sketch.setup( () => {
  const p = getP5();

  canvases.buffer = p.createGraphics(
    p.width,
    p.height,
    "webgl"
  );

  canvases.pixilated = p.createGraphics(
    p.width,
    p.height
  );

  canvases.mask = p.createGraphics(
    p.width,
    p.height
  );

  canvases.pixilated.pixelDensity( 0.06 );
} );

function drawShape( {
  canvas = getP5(), depth = 60, text = "sinewave"
} ) {
  canvas.background( ...( options.sketch.shape.backgroundColor ?? [
    0
  ] ) );
  const canvasFlatDimensionAverage = ( canvas.width + canvas.height ) / 2;

  const points = animation.ease( {
    values: text.split( "" ).map( ( text ) =>
      string.getTextPoints( {
        text,
        position: canvas.createVector(
          0,
          0
        ),
        sampleFactor: options.sketch.shape.sampleFactor,
        size: canvasFlatDimensionAverage * options.sketch.shape.sizeRatio,
        simplifyThreshold: options.sketch.shape.simplifyThreshold,
        font: string.fonts?.[ options.sketch.shape.font ?? "sans" ]
      } ) ),
    lerpFn: mappers.lerpPoints,
    currentTime:
      animation.progression * text.length * options.sketch.shape.morphingSpeed,
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

      const opacityFactor =
        mappers.fn(
          canvas.sin(
            depthProgression * 2 * canvas.PI,
            easing.easeInOutExpo
          ),
          -1,
          1,
          1,
          1
        ) * Math.pow(
          1.175,
          z
        );

      canvas.stroke( colorFunction( {
        hueOffset:
            // +depthProgression*10
            // +mappers.fn(depthProgression, 0, 1, 0, p.PI/2, easing.easeInOutExpo)
            +animation.progression,
        // hueIndex: mappers.circularPolar(progression, 0, 1, -p.PI, p.PI)*2,
        hueIndex:
            mappers.fn(
              canvas.noise(
                x / canvas.width,
                y / canvas.height + animation.progression * 1,
                depthProgression / 2
              ),
              0,
              1,
              -canvas.PI,
              canvas.PI
            ) * 14,
        // hueIndex:mappers.fn(canvas.noise(x/canvas.width, y/canvas.height, progression/2+depthProgression/2), 0, 1, -canvas.PI, canvas.PI)*10,
        opacityFactor
        // opacityFactor: p.map(depthProgression, 0, 1, 1.75, 1) * Math.pow(1.05, z)
      } ) );

      const xx =
        x * mappers.fn(
          z,
          0,
          depth,
          1,
          0,
          easing.easeInExpo
        ) +
        x * Math.pow(
          1.1,
          z
        );

      const yy =
        y * mappers.fn(
          z,
          0,
          depth,
          1,
          0,
          easing.easeInExpo
        ) +
        y * Math.pow(
          1.12,
          z
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
  canvas = getP5(), step = options.sketch.wave.step
) {
  const values = [
    canvas.height * options.sketch.wave.heightStart,
    canvas.height * options.sketch.wave.heightEnd
  ];

  for ( let index = 0; index < 1; index += step ) {
    canvas.vertex(
      index * canvas.width,
      animation.ease( {
        values,
        currentTime:
          +index * options.sketch.wave.count +
          animation.progression * options.sketch.wave.speed,
        easingFn: easing?.[ options.sketch.wave.easing ?? "easeInOutSine" ]
      } )
    );
  }
}

sketch.draw( (
  _time, _center, favoriteColor
) => {
  const p = getP5();

  p.noSmooth();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  drawShape( {
    canvas: canvases.buffer,
    depth: options.sketch.shape.depthCount,
    text: options.sketch.shape.text
  } );

  p.image(
    canvases.buffer,
    0,
    0,
    p.width,
    p.height
  );

  canvases.pixilated.image(
    canvases.buffer.get(),
    0,
    0,
    p.width,
    p.height
  );

  canvases.mask.erase();
  canvases.mask.rect(
    0,
    0,
    p.width,
    p.height
  );
  canvases.mask.noErase();
  canvases.mask.beginShape();

  wave( canvases.mask );

  canvases.mask.vertex(
    p.width,
    p.height
  );
  canvases.mask.vertex(
    0,
    p.height
  );
  canvases.mask.endShape( p.CLOSE );

  const maskedImage = canvases.pixilated.get();

  maskedImage.mask( canvases.mask );

  p.image(
    maskedImage,
    0,
    0
  );

  // p.image(
  //   canvases.pixilated,
  //   0,
  //   0,
  //   canvas.width,
  //   canvas.height
  // );

  p.noFill();
  p.strokeWeight( options.sketch.wave.strokeWeight );
  p.stroke( options.sketch.wave.stroke ?? favoriteColor );

  p.beginShape();
  wave( );
  if ( options.sketch.wave.close ) {
    p.endShape( p.CLOSE );
  } else {
    p.endShape();
  }

  canvases.pixilated.pixelDensity( options.sketch.pixelDensity );
} );
