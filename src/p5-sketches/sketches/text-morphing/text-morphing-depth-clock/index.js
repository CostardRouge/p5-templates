import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";

const sketchState = {
  threeDimensionGraphics: null,
};

sketch.setup(
  ( {
    canvas
  } ) => {
    sketchState.threeDimensionGraphics = createGraphics(
      canvas.width,
      canvas.height,
      "webgl"
    );
  },
  {
  }
);

sketch.draw( ( time ) => {
  clear();
  background( ...( options.sketch.backgroundColor ?? [
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
    itemsToMorph.push( ...( "0123456789".split( "" ) ) );
  }

  const morphingEasingFunction = easing?.[ options.sketch.morphing.easing ] ?? easing.easeInOutExpo;

  const size = options.sketch.textStyle.size * width ?? width / 2;
  const font = string.fonts?.[ options.sketch?.textStyle.font ] ?? string.fonts.serif;

  const sampleFactor = options.sketch.textStyle.sampleFactor ?? 0.05;
  const simplifyThreshold = options.sketch.textStyle.simplifyThreshold ?? 0;

  const steps = itemsToMorph.length;
  const phase = animation.progression * steps;
  const t = phase % 1; // 0 → 1 inside each morph

  const changeProgress = mappers.fn(
    t,
    0,
    1,
    0,
    1,
    easing.easeInOutSine
  );

  const changeProgressSmooth = mappers.fn(
    sin( t * PI ),
    0,
    1,
    1,
    0,
    easing.easeInOutBack
  );

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

  const W = width / 2 - size / 2;
  const H = height / 2 - size / 2;

  const depth = options.sketch.morphing.depthLayersCount ?? 200 / 4;
  const rotationEnabled = options.sketch.rotation.enabled ?? true;
  const xMultiplier = options.sketch.rotation.xMultiplier ?? 3;
  const yMultiplier = options.sketch.rotation.yMultiplier ?? 2;
  const rotationEasingFunction = easing?.[ options.sketch.rotation.easing ] ?? easing.easeInOutElastic;

  const clockPositions = [
  ];

  if ( rotationEnabled ) {
    itemsToMorph.forEach( (
      _, index
    ) => {
      const angle = ( index / ( itemsToMorph.length ) ) * TAU;

      clockPositions.push( createVector(
        map(
          Math.sin( -angle * xMultiplier - PI ),
          -1,
          1,
          -W,
          W
        ),
        map(
          Math.cos( -angle * yMultiplier - PI ),
          -1,
          1,
          -H,
          H
        ),
      ) );
    } );
  }

  for ( let z = 0; z < depth; z++ ) {
    const depthProgression = z / ( depth - 1 );

    const zPosition = mappers.fn(
      depthProgression,
      0,
      1,
      0,
      ( options.sketch.morphing.depthLength ?? 0.2 ) * ( width + height ),
      easing?.[ options.sketch.morphing.depthEasing ] ?? easing.easeOutExpo
    );

    sketchState.threeDimensionGraphics.push();

    if ( rotationEnabled ) {
      const clockPosition = animation.ease( {
        values: clockPositions,
        currentTime: animation.progression * itemsToMorph.length,
        lerpFn: p5.Vector.lerp,
        easingFn: rotationEasingFunction
      } );

      // const clockPosition = p5.Vector.lerp(
      //   createVector(
      //     map(
      //       Math.sin( -animation.angle * xMultiplier - PI ),
      //       -1,
      //       1,
      //       -W,
      //       W
      //     ),
      //     map(
      //       Math.cos( -animation.angle * yMultiplier - PI ),
      //       -1,
      //       1,
      //       -H,
      //       H
      //     ),
      //   ),
      //   createVector(
      //     0,
      //     0
      //   ),
      //   depthProgression
      // );

      sketchState.threeDimensionGraphics.translate(
        clockPosition.x,
        clockPosition.y,
      );
    }

    sketchState.threeDimensionGraphics.translate(
      0,
      0,
      zPosition
    );

    sketchState.threeDimensionGraphics.strokeWeight( mappers.fn(
      ( options.sketch.point.varyStrokeWithDepthProgression ?? true ) ? depthProgression : changeProgressSmooth,
      0,
      1,
      options.sketch.point.strokeWeightMax ?? 20,
      options.sketch.point.strokeWeightMin ?? 3,
      easing?.[ options.sketch.point.strokeWeightEasing ] ?? easing.easeInOutExpo
    ) );

    for ( let i = 0; i < points.length; i++ ) {
      const progression = i / ( points.length - 1 );

      const {
        x, y
      } = points[ i ];
      const colorFunction = colors.rainbow;
      const opacityFactor = mappers.fn(
        sin(
          depthProgression * 20 + animation.angle * 3,
          easing.easeInOutExpo
        ),
        -1,
        1,
        1.75,
        1
      ) * Math.pow(
        1.1,
        z
      );

      if ( opacityFactor > 30 ) {
        continue;
      }

      sketchState.threeDimensionGraphics.stroke( colorFunction( {
        hueOffset: depthProgression,
        hueIndex: mappers.fn(
          noise(
            ( x / width ) + animation.circularProgression,
            ( y / height ) + animation.circularProgression,

            depthProgression // + animation.circularProgression,
          ),
          0,
          1,
          -PI,
          PI
        ) * map(
          depthProgression,
          0,
          1,
          16,
          32
        ),
        opacityFactor,
      } ) );

      const xx = x * Math.pow(
        1.11,
        z
      );

      const yy =
        y * Math.pow(
          1.11,
          z
        );

      sketchState.threeDimensionGraphics.point(
        xx,
        yy
      );
    }
    sketchState.threeDimensionGraphics.pop();
  }

  if ( options.sketch.rotation.enabled ) {
    sketchState.threeDimensionGraphics.pop();
  }

  image(
    sketchState.threeDimensionGraphics,
    0,
    0
  );
  sketchState.threeDimensionGraphics.clear();
  sketchState.threeDimensionGraphics.reset();
} );
