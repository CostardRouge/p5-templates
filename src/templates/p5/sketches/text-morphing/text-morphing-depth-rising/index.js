import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  getLoopPhase
} from "@/p5/utils/common.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const sketchState = {
  threeDimensionGraphics: null,
};

sketch.setup(
  ( {
    canvas
  } ) => {
    const p = getP5();

    sketchState.threeDimensionGraphics = p.createGraphics(
      canvas.width,
      canvas.height,
      "webgl"
    );
  },
  {
  }
);

let pointLength = 0;

sketch.draw( ( time ) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const itemsToMorph = [
  ];

  if ( "single" === options.sketch.text.mode ) {
    itemsToMorph.push( ...( options.sketch.text.value.split( "" ) ) );
  }

  if ( "multiple" === options.sketch.text.mode ) {
    itemsToMorph.push( ...options.sketch.text.value );
  }

  if ( itemsToMorph.length === 0 ) {
    itemsToMorph.push( ...( String.fromCharCode( ...Array( 26 ).keys()
      .map( i => i + 97 ) ).split( "" ) ) );
  }

  const morphingEasingFunction = easing?.[ options.sketch.morphing.easing ] ?? easing.easeInOutExpo;

  const size = options.sketch.textStyle.size * p.width ?? p.width / 2;
  const font = string.fonts?.[ options.sketch?.textStyle.font ] ?? string.fonts.serif;

  const sampleFactor = options.sketch.textStyle.sampleFactor ?? 0.05;
  const simplifyThreshold = options.sketch.textStyle.simplifyThreshold ?? 0;

  const steps = itemsToMorph.length;
  const phase = animation.progression * steps;
  const t = phase;
  // const changeProgress = mappers.fn(
  //   t,
  //   0,
  //   1,
  //   0,
  //   1,
  //   easing.easeInOutExpo
  // );

  const points = animation.ease( {
    values: itemsToMorph.map( text => (
      string.getTextPoints( {
        text,
        size,
        font,
        sampleFactor,
        simplifyThreshold
      } )
    ) ),
    currentTime: phase,
    lerpFn: mappers.lerpPoints,
    easingFn: morphingEasingFunction
  } );

  pointLength = Math.max(
    pointLength,
    points.length
  );

  const depth = options.sketch.morphing.depthLayersCount ?? 200 / 4;
  const D = 3 * ( p.width + p.height );

  for ( let z = 0; z < depth; z++ ) {
    const depthProgression = z / ( depth - 1 );

    sketchState.threeDimensionGraphics.strokeWeight( mappers.fn(
      depthProgression,
      0,
      1,
      options.sketch.point.strokeWeightMax ?? 20,
      options.sketch.point.strokeWeightMin ?? 3,
      easing?.[ options.sketch.point.strokeWeightEasing ] ?? easing.easeInOutExpo
    ) );

    for ( let i = 0; i < points.length; i++ ) {
      const progression = i / pointLength;// ( points.length - 1 );

      const {
        x, y
      } = points[ i ];

      const changeProgressSmooth = mappers.fn(
        // Math.sin( t * p.PI ),
        p.sin( getLoopPhase( [
          [
            t,
            p.PI,
          ],
          [
            progression,
            3
          ],
          // [
          //   depthProgression,
          //   1
          // ]
        ] ) ),
        -1,
        1,
        1,
        0,
        // easing.easeInOutBack
        // morphingEasingFunction
      );

      const power = p.map(
        changeProgressSmooth,
        0,
        1,
        1,
        1.15
      );

      const zPosition = mappers.fn(
        depthProgression,
        0,
        1,
        0,
        -D
      ) * Math.pow(
        power,
        z
      );

      const colorFunction = colors?.[ options.sketch.strokeColor.colorFunction ] ?? colors.rainbow;
      const opacityFactor = mappers.fn(
        Math.sin( getLoopPhase( [
          [
            animation.angle,
            1,
          ],
          [
            depthProgression,
            9
          ],
          [
            progression,
            9
          ],
        ] ) ),
        -1,
        1,
        1.5,
        1,
      ) * Math.pow(
        1.2,
        z
      );

      if ( opacityFactor > 30 ) {
        continue;
      }

      sketchState.threeDimensionGraphics.stroke( colorFunction( {
        // opacityFactor: getVariableOptionValue(
        //   options.sketch.strokeColor.opacityFactor,
        //   {
        //     x: x / p.width,
        //     y: y / p.height,
        //     z: depthProgression,
        //   }
        // ),
        // hueIndex: getVariableOptionValue(
        //   options.sketch.strokeColor.hueIndex,
        //   {
        //     x: x / p.width,
        //     y: y / p.height,
        //     z: depthProgression,
        //   }
        // ),
        //
        hueOffset: depthProgression,
        hueIndex: mappers.fn(
          // p.noise(
          //   ( x / p.width ) + strokeHueOffset,
          //   ( y / p.height ) + strokeHueOffset,
          //   depthProgression + strokeHueOffset,
          // ),
          Math.sin( getLoopPhase( [
            [
              animation.angle,
              1,
            ],
            [
              depthProgression,
              9
            ],
            [
              progression,
              9
            ],
          ] ) ),
          -1,
          1,
          -p.PI,
          p.PI
        ),
        opacityFactor
      } ) );

      const xx = x * Math.pow(
        1.125,
        z
      );

      const yy =
        y * Math.pow(
          1.125,
          z
        );

      sketchState.threeDimensionGraphics.point(
        xx,
        yy,
        zPosition
      );
    }
  }

  p.image(
    sketchState.threeDimensionGraphics,
    0,
    0
  );
  sketchState.threeDimensionGraphics.clear();
  sketchState.threeDimensionGraphics.reset();

  renderTitle();
} );
