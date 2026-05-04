import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import string from "@/p5/utils/string.js";
import mappers from "@/p5/utils/mappers.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const sketchState = {
  threeDimensionGraphics: null
};

sketch.setup(
  ( ) => {
    const p = getP5();

    sketchState.threeDimensionGraphics = graphics.createAutoResizableGraphics(
      p.width,
      p.height,
      "webgl"
    );
  },
  {}
);

function cross(
  {
    x, y, z
  }, size
) {
  sketchState.threeDimensionGraphics.line(
    x - size / 2,
    y - size / 2,
    z,
    x + size / 2,
    y + size / 2,
    z
  );
  sketchState.threeDimensionGraphics.line(
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
  sketchState.threeDimensionGraphics.push();

  sketchState.threeDimensionGraphics.stroke( ...( options.sketch.sliders.stroke ?? [
    128,
    128,
    255
  ] ) );

  const currentProgression = mappers.lerpVector(
    start,
    end,
    progression
  );

  if ( options.sketch.sliders.line.enabled ?? true ) {
    sketchState.threeDimensionGraphics.strokeWeight( options.sketch.sliders.line.strokeWeight ?? 3.5 );
    sketchState.threeDimensionGraphics.line(
      start.x,
      start.y,
      start.z,
      currentProgression.x,
      currentProgression.y,
      currentProgression.z
    );
  }

  if ( options.sketch.sliders.cross.enabled ?? true ) {
    sketchState.threeDimensionGraphics.strokeWeight( options.sketch.sliders.cross.strokeWeight ?? 5 );

    cross(
      start,
      options.sketch.sliders.cross.size ?? 20
    );
    cross(
      end,
      options.sketch.sliders.cross.size ?? 20
    );
  }

  if ( options.sketch.sliders.circle.enabled ?? true ) {
    sketchState.threeDimensionGraphics.push();
    sketchState.threeDimensionGraphics.translate(
      currentProgression.x,
      currentProgression.y,
      1
    );

    sketchState.threeDimensionGraphics.fill( ...( options.sketch.sliders.circle.fill ?? [
      0
    ] ) );
    sketchState.threeDimensionGraphics.strokeWeight( options.sketch.sliders.circle.strokeWeight ?? 5 );
    sketchState.threeDimensionGraphics.circle(
      0,
      0,
      options.sketch.sliders.circle.radius ?? 20
    );
    sketchState.threeDimensionGraphics.pop();
  }

  sketchState.threeDimensionGraphics.pop();
}

sketch.draw( (
  time, center
) => {
  const p = getP5();

  p.background( 0 );

  const W = p.width / 2;
  const H = p.height / 2;

  const easingFunction =
    easing?.[ options.sketch.morphing.easing ] ?? easing.easeInOutExpo;

  const xProgression = mappers.fn(
    Math.sin( animation.angle ),
    -1,
    1,
    0,
    1,
    easingFunction
  );

  const yProgression = mappers.fn(
    Math.cos( animation.angle ),
    -1,
    1,
    0,
    1,
    easingFunction
  );
  const zProgression = mappers.fn(
    Math.sin( animation.angle + animation.angle ),
    -1,
    1,
    0,
    1,
    easingFunction
  );

  // const xProgression = p.map(
  //   winMouseX,
  //   0,
  //   p.width,
  //   0,
  //   1
  // );
  // const yProgression = p.map(
  //   winMouseY,
  //   0,
  //   p.height,
  //   0,
  //   1
  // );

  if ( options.sketch.sliders.enabled ?? true ) {
    const margin = ( options.sketch.sliders.margin ?? 0.1 ) * p.width;

    drawProgression(
      xProgression,
      sketchState.threeDimensionGraphics.createVector(
        -W + margin,
        H - margin
      ),
      sketchState.threeDimensionGraphics.createVector(
        W - margin,
        H - margin
      )
    );
    drawProgression(
      yProgression,
      sketchState.threeDimensionGraphics.createVector(
        -W + margin,
        H - margin
      ),
      sketchState.threeDimensionGraphics.createVector(
        -W + margin,
        -H + margin
      )
    );
    // drawProgression(
    //   zProgression,
    //   sketchState.threeDimensionGraphics.createVector(
    //     -W + margin,
    //     H - margin
    //   ),
    //   sketchState.threeDimensionGraphics.createVector(
    //     -W + margin,
    //     H - margin,
    //     -H
    //   )
    // );
  }

  const size = options.sketch.text.size * p.width ?? p.width / 2;
  const font = string.fonts?.[ options.sketch?.text.font ] ?? string.fonts.serif;

  const sampleFactor = options.sketch.text.sampleFactor ?? 0.05;
  const simplifyThreshold = options.sketch.text.simplifyThreshold ?? 0;
  const letterPosition = p.createVector(
    0,
    0
  );

  // FROM
  const fromLowerCased = string.getTextPoints( {
    text: options.sketch.text.from.toLocaleLowerCase() ?? "a",
    position: letterPosition,
    size,
    font,
    sampleFactor,
    simplifyThreshold
  } );

  const fromUpperCased = string.getTextPoints( {
    text: options.sketch.text.from.toLocaleUpperCase() ?? "A",
    position: letterPosition,
    size,
    font,
    sampleFactor,
    simplifyThreshold
  } );

  const fromAnimatedPoints = animation.ease( {
    values: [
      fromLowerCased,
      fromUpperCased
    ],
    currentTime: yProgression,
    lerpFn: mappers.lerpPoints
  } );

  // TO
  const toLowerCased = string.getTextPoints( {
    text: options.sketch.text.to.toLocaleLowerCase() ?? "z",
    position: letterPosition,
    size,
    font,
    sampleFactor,
    simplifyThreshold
  } );

  const toUpperCased = string.getTextPoints( {
    text: options.sketch.text.to.toLocaleUpperCase() ?? "Z",
    position: letterPosition,
    size,
    font,
    sampleFactor,
    simplifyThreshold
  } );

  const toAnimatedPoints = animation.ease( {
    values: [
      toLowerCased,
      toUpperCased
    ],
    currentTime: yProgression,
    lerpFn: mappers.lerpPoints
  } );

  // FINAL
  const points = animation.ease( {
    values: [
      fromAnimatedPoints,
      toAnimatedPoints
    ],
    currentTime: xProgression,
    lerpFn: mappers.lerpPoints
  } );

  sketchState.threeDimensionGraphics.push();

  const depth = options.sketch.morphing.depthLayersCount ?? 200 / 4;

  for ( let z = 0; z < depth; z++ ) {
    const depthProgression = -( z / depth );

    sketchState.threeDimensionGraphics.push();
    sketchState.threeDimensionGraphics.translate(
      0,
      0,
      p.map(
        z,
        0,
        depth,
        0,
        ( options.sketch.morphing.depthLength ?? 0.2 ) * ( p.width + p.height )
      )
    );

    sketchState.threeDimensionGraphics.strokeWeight( mappers.fn(
      z,
      0,
      depth,
      options.sketch.morphing.point.strokeWeightMax ?? 20,
      options.sketch.morphing.point.strokeWeightMin ?? 3,
      easing?.[ options.sketch.morphing.point.strokeWeightEasing ] ??
          easing.easeOutExpo
    ) );

    for ( let i = 0; i < points.length; i++ ) {
      const progression = i / points.length;

      const {
        x, y
      } = points[ i ];
      const colorFunction = colors.rainbow;
      const opacityFactor =
        mappers.fn(
          p.sin(
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
        hueOffset:
            // +depthProgression*10
            // +mappers.fn(depthProgression, 0, 1, 0, p.PI/2, easing.easeInOutExpo)
            // +time
            +0,
        // hueIndex: mappers.circularPolar(progression, 0, 1, -p.PI, p.PI)*2,
        hueIndex:
            mappers.fn(
              p.noise(
                x / p.width,
                y / p.height,
                progression / 2 + depthProgression / 2 + time / 16
              ),
              0,
              1,
              -p.PI,
              p.PI
            ) * 10,
        // hueIndex:mappers.fn(p.noise(x/p.width, y/p.height, progression/2+depthProgression/2), 0, 1, -p.PI, p.PI)*10,
        opacityFactor
        // opacityFactor: p.map(depthProgression, 0, 1, 3, 1) * Math.pow(1.05, z)
      } ) );

      const xx = x * mappers.fn(
        z,
        0,
        depth,
        1,
        -1,
        easing.s
      ) + x;

      const yy = y * mappers.fn(
        z,
        0,
        depth,
        1,
        -1,
        easing.s
      ) + y;

      sketchState.threeDimensionGraphics.point(
        xx,
        yy
      );
    }
    sketchState.threeDimensionGraphics.pop();
  }
  sketchState.threeDimensionGraphics.pop();

  p.image(
    sketchState.threeDimensionGraphics,
    0,
    0
  );
  sketchState.threeDimensionGraphics.clear();
  sketchState.threeDimensionGraphics.reset();

  renderTitle();
} );
