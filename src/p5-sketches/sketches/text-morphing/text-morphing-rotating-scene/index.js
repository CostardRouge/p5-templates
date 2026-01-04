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
  const rotationEasingFunction = easing?.[ options.sketch.rotation.easing ] ?? easing.easeInOutExpo;

  const size = options.sketch.textStyle.size * width ?? width / 2;
  const font = string.fonts?.[ options.sketch?.textStyle.font ] ?? string.fonts.serif;

  const sampleFactor = options.sketch.textStyle.sampleFactor ?? 0.05;
  const simplifyThreshold = options.sketch.textStyle.simplifyThreshold ?? 0;

  const steps = itemsToMorph.length;
  const phase = ( animation.progression * steps ) % steps;
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

  if ( options.sketch.rotation.enabled ) {
    const rotationAngles = options.sketch.rotation.rotationAngles.map( ( {
      x, y, z
    } ) => createVector(
      x,
      y,
      z
    ) ) ?? [
      createVector(
        0,
        0,
        0
      ),
      createVector(
        PI / 5,
        0,
        0
      ),
      createVector(
        -PI / 5,
        PI / 5,
        0
      ),
      createVector(
        PI / 4,
        PI / 5
      ),
      createVector(
        -PI / 5,
        -PI / 5,
        0
      ),
    ];

    const {
      x: rX, y: rY, z: rZ
    } = animation.ease( {
      values: rotationAngles,
      currentTime: phase,
      lerpFn: p5.Vector.lerp,
      easingFn: rotationEasingFunction
    } );

    rotationAngles.forEach( angle => {
      angle.mult( map(
        changeProgressSmooth,
        1,
        0,
        0.5,
        1
      ) );
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
      ( options.sketch.morphing.depthLength ?? 0.2 ) * ( width + height ),
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
        sin(
          depthProgression * 20 + animation.angle * 5,
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
          noise(
            x / width,
            y / height,
            depthProgression + map(
              animation.progression,
              0,
              1,
              0,
              animation.angle / 4
            ),
          ),
          0,
          1,
          -PI,
          PI
        ) * map(
          animation.progression,
          0,
          1,
          8,
          16
        ),
        opacityFactor,
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

  image(
    sketchState.threeDimensionGraphics,
    0,
    0
  );
  sketchState.threeDimensionGraphics.clear();
  sketchState.threeDimensionGraphics.reset();
} );
