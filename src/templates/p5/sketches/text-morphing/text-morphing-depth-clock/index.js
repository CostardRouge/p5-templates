import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
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
    itemsToMorph.push( ...( "0123456789".split( "" ) ) );
  }

  const morphingEasingFunction = easing?.[ options.sketch.morphing.easing ] ?? easing.easeInOutExpo;

  const size = options.sketch.textStyle.size * p.width ?? p.width / 2;
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
    p.sin( t * p.PI ),
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

  const W = p.width / 2 - size / 2;
  const H = p.height / 2 - size / 2;

  const depth = options.sketch.morphing.depthLayersCount ?? 200 / 4;
  const rotationEnabled = options.sketch.rotation.enabled ?? true;
  const xMultiplier = options.sketch.rotation.xMultiplier ?? 3;
  const yMultiplier = options.sketch.rotation.yMultiplier ?? 2;
  const rotationEasingFunction = easing?.[ options.sketch.rotation.easing ] ?? easing.easeInOutElastic;

  const depthProgressionMultiplier = options.sketch.rotation.depthProgressionMultiplier ?? 2;

  const clockPositions = [
  ];

  if ( rotationEnabled ) {
    itemsToMorph.forEach( (
      _, index
    ) => {
      const angle = ( index / ( itemsToMorph.length ) ) * p.TAU;

      clockPositions.push( p.createVector(
        p.map(
          Math.sin( -angle * xMultiplier - p.PI ),
          -1,
          1,
          -W,
          W
        ),
        p.map(
          Math.cos( -angle * yMultiplier - p.PI ),
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
      ( options.sketch.morphing.depthLength ?? 0.2 ) * ( p.width + p.height ),
      easing?.[ options.sketch.morphing.depthEasing ] ?? easing.easeOutExpo
    );

    sketchState.threeDimensionGraphics.push();

    if ( rotationEnabled ) {
      const clockPosition = animation.ease( {
        values: clockPositions,
        currentTime: (
          animation.progression * itemsToMorph.length
          + depthProgression * depthProgressionMultiplier
        ),
        lerpFn: mappers.lerpVector,
        easingFn: rotationEasingFunction
      } );

      // const clockPosition = mappers.lerpVector(
      //   p.createVector(
      //     p.map(
      //       Math.sin( -animation.angle * xMultiplier - p.PI ),
      //       -1,
      //       1,
      //       -W,
      //       W
      //     ),
      //     p.map(
      //       Math.cos( -animation.angle * yMultiplier - p.PI ),
      //       -1,
      //       1,
      //       -H,
      //       H
      //     ),
      //   ),
      //   p.createVector(
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
        p.sin(
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
          p.noise(
            ( x / p.width ) + animation.circularProgression,
            ( y / p.height ) + animation.circularProgression,

            depthProgression // + animation.circularProgression,
          ),
          0,
          1,
          -p.PI,
          p.PI
        ) * p.map(
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

  // if ( options.sketch.rotation.enabled ) {
  //   sketchState.threeDimensionGraphics.pop();
  // }

  p.image(
    sketchState.threeDimensionGraphics,
    0,
    0
  );
  sketchState.threeDimensionGraphics.clear();
  sketchState.threeDimensionGraphics.reset();
  renderTitle();
} );
