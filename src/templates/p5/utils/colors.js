import {
  getP5
} from "./sketch.js";

const colors = {
  test: ( {
    hueOffset = 0,
    hueIndex,
    opacityFactor = 1,
    min = 0,
    max = 360,
    easingFunction
  } ) => {
    const p = getP5();

    return p.color(
      p.map(
        p.sin(
          p.PI * hueIndex + hueOffset,
          hueOffset
        ),
        -1,
        1,
        min,
        max
      ) /
        opacityFactor,
      p.map(
        p.cos(
          p.PI * ( hueIndex + 1 / 3 + hueOffset ),
          hueOffset
        ),
        -1,
        1,
        min,
        max
      ) / opacityFactor,
      p.map(
        p.cos(
          p.PI * ( hueIndex + 2 / 3 + hueOffset ),
          hueOffset
        ),
        -1,
        1,
        min,
        max
      ) / opacityFactor
    );
  },
  rainbowCrazy: ( {
    hueOffset = 0,
    hueIndex,
    opacityFactor = 1,
    min = 0,
    max = 360,
    easingFunction
  } ) => {
    const p = getP5();

    return p.color(
      p.map(
        ( easingFunction ?? Math.cos )( hueOffset - hueIndex ),
        -1,
        1,
        min,
        max
      ) /
        opacityFactor,
      p.map(
        ( easingFunction ?? Math.sin )( hueOffset + hueIndex ),
        -1,
        1,
        max,
        min
      ) /
        opacityFactor,
      p.map(
        ( easingFunction ?? Math.cos )( hueOffset - hueIndex ),
        -1,
        1,
        max,
        min
      ) /
        opacityFactor
    );
  },
  rainbow: ( {
    hueOffset = 0,
    hueIndex,
    opacityFactor = 1,
    min = 0,
    max = 360,
    easingFunction,
    alpha = 255
  } ) => {
    const p = getP5();

    return p.color(
      p.map(
        ( easingFunction ?? Math.sin )( hueOffset + hueIndex ),
        -1,
        1,
        min,
        max
      ) /
        opacityFactor,
      p.map(
        ( easingFunction ?? Math.cos )( hueOffset - hueIndex ),
        -1,
        1,
        max,
        min
      ) /
        opacityFactor,
      p.map(
        ( easingFunction ?? Math.sin )( hueOffset + hueIndex ),
        -1,
        1,
        max,
        min
      ) /
        opacityFactor,
      alpha
    );
  },
  darkBlueYellow: ( {
    hueOffset = 0,
    hueIndex,
    opacityFactor = 1,
    min = 0,
    max = 360
  } ) => {
    const p = getP5();

    return p.color(
      p.map(
        p.cos( hueOffset + hueIndex ),
        -1,
        1,
        min,
        max
      ) / opacityFactor,
      p.map(
        p.cos( hueOffset + hueIndex ),
        -1,
        1,
        min,
        max
      ) / opacityFactor,
      p.map(
        p.sin( hueOffset + hueIndex ),
        -1,
        1,
        max,
        min
      ) / opacityFactor
    );
  },
  purple: ( {
    hueOffset = 0,
    hueIndex,
    opacityFactor = 1,
    min = 0,
    max = 360
  } ) => {
    const p = getP5();

    return p.color(
      max / 4 / opacityFactor,
      p.map(
        p.sin( hueOffset - hueIndex ),
        -1,
        1,
        max / 2,
        0
      ) / opacityFactor,
      max / opacityFactor
    );
  },
  purpleSimple: ( {
    hueOffset = 0,
    hueIndex,
    opacityFactor = 1,
    min = 0,
    max = 360
  } ) => getP5().color(
    128,
    128,
    255
  ),
  green: ( {
    hueOffset = 0, hueIndex, opacityFactor = 1, min = 0, max = 360
  } ) =>
    getP5().color(
      92,
      255,
      128
    ),
  black: ( {
    hueOffset = 0, hueIndex, opacityFactor = 1, min = 0, max = 360
  } ) =>
    getP5().color(
      4,
      2,
      8
    ),

  chunk: (
    array, chunkSize
  ) => {
    const chunkedArray = [];

    for ( let i = 0; i < array.length; i += chunkSize ) {
      chunkedArray.push( array.slice(
        i,
        i + chunkSize
      ) );
    }

    return chunkedArray;
  },
  getDominantColorFromPixels: (
    pixels, precision = 100
  ) => {
    const p = getP5();
    const chunkedPixels = colors.chunk(
      pixels,
      4
    );

    const filteredPixels = chunkedPixels.filter( (
      [
        r,
        g,
        b
      ], index
    ) =>
      index % precision === 0 && [
        r,
        g,
        b
      ].every( ( channel ) => channel > 10 ) );

    return filteredPixels.reduce(
      (
        accumulator, [
          r,
          g,
          b,
          a
        ]
      ) => {
        const pixelColor = p.color(
          r,
          g,
          b,
          a
        );

        if ( null === accumulator ) {
          return pixelColor;
        }

        return p.lerpColor(
          accumulator,
          pixelColor,
          0.5
        );
      },
      null
    );
  },

  getDominantColor: (
    img, precision
  ) => {
    img.loadPixels();

    return colors.getDominantColorFromPixels(
      img.pixels,
      precision
    );
  }
};

export default colors;
