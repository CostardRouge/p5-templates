import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const sketchState = sketch.state( () => ( {
  threeDimensionGraphics: null
} ) );

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
  {}
);

sketch.draw( ( time ) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const itemsToMorph = [];

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

  if ( options.sketch.rotation.enabled ) {
    const rotationAngles = options.sketch.rotation.rotationAngles.map( ( {
      x, y, z
    } ) => p.createVector(
      x,
      y,
      z
    ) ) ?? [
      p.createVector(
        0,
        0,
        0
      ),
      p.createVector(
        p.PI / 5,
        0,
        0
      ),
      p.createVector(
        -p.PI / 5,
        p.PI / 5,
        0
      ),
      p.createVector(
        p.PI / 4,
        p.PI / 5
      ),
      p.createVector(
        -p.PI / 5,
        -p.PI / 5,
        0
      )
    ];

    const rotationSteps = rotationAngles.length;
    const phase = animation.progression * rotationSteps;

    if ( options.sketch.rotation.syncWithMorphing ) {
      const diffLength = itemsToMorph.length - rotationAngles.length;

      if ( diffLength ) {
        for ( let i = 0; i < diffLength; ++i ) {
          rotationAngles.push( rotationAngles[ i % rotationAngles.length ] );
        }
      }
    }

    if ( options.sketch.rotation.angleMultiplier !== 1 ) {
      rotationAngles.forEach( angle => {
        angle.mult( options.sketch.rotation.angleMultiplier );
      } );
    }

    const {
      x: rX, y: rY, z: rZ
    } = animation.ease( {
      values: rotationAngles,
      currentTime: phase,
      lerpFn: mappers.lerpVector,
      easingFn: easing?.[ options.sketch.rotation.easing ] ?? easing.easeInOutExpo
    } );

    sketchState.threeDimensionGraphics.push();

    sketchState.threeDimensionGraphics.rotateX( rX );
    sketchState.threeDimensionGraphics.rotateY( rY );
    sketchState.threeDimensionGraphics.rotateZ( rZ );
  }

  const depth = options.sketch.morphing.depthLayersCount ?? 200 / 4;

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

      if ( opacityFactor > 20 ) {
        continue;
      }

      sketchState.threeDimensionGraphics.stroke( colorFunction( {
        hueOffset: 0,
        hueIndex: mappers.fn(
          p.noise(
            x / p.width,
            y / p.height,
            depthProgression // + animation.circularProgression,
          ),
          0,
          1,
          -p.PI,
          p.PI
        ) * p.map(
          animation.circularProgression,
          0,
          1,
          8,
          16
        ),
        opacityFactor
      } ) );

      const xx = x * Math.pow(
        1.1,
        z
      );

      const yy =
        y * Math.pow(
          1.1,
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

  p.image(
    sketchState.threeDimensionGraphics,
    0,
    0
  );
  sketchState.threeDimensionGraphics.clear();
  sketchState.threeDimensionGraphics.reset();
} );
