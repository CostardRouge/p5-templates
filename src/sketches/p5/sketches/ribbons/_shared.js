import {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import iterators from "@/p5/utils/iterators.js";

export function drawer(
  lerper, positioner, shaper, time, index = 0, targets = null
) {
  const p = getP5();
  const [
    lerpMin,
    lerpMax,
    lerpStep
  ] = lerper(
    time,
    index
  );

  const canvases = targets ?? [
    p
  ];
  const step = Math.max(
    lerpStep,
    1e-6
  );

  for ( let lerpIndex = lerpMin; lerpIndex <= lerpMax; lerpIndex += step ) {
    canvases.forEach( ( canvas ) => {
      canvas.push();
      positioner(
        lerpIndex,
        lerpMin,
        lerpMax,
        step,
        time,
        index,
        canvas
      );
      shaper(
        lerpIndex,
        lerpMin,
        lerpMax,
        time,
        index,
        canvas
      );
      canvas.pop();
    } );
  }
}

export const palettes = {
  rainbow: (
    hueSpeed, lerpIndex, opacityFactor, alpha
  ) => {
    const p = getP5();

    return p.color(
      p.map(
        p.sin( hueSpeed + lerpIndex * 5 ),
        -1,
        1,
        0,
        360
      ) / opacityFactor,
      p.map(
        p.sin( hueSpeed - lerpIndex * 5 ),
        -1,
        1,
        360,
        0
      ) / opacityFactor,
      p.map(
        p.sin( hueSpeed + lerpIndex * 5 ),
        -1,
        1,
        360,
        0
      ) / opacityFactor,
      alpha ?? 255
    );
  },
  "rainbow-trip": (
    hueSpeed, lerpIndex, opacityFactor, alpha
  ) => {
    const p = getP5();

    return p.color(
      p.map(
        p.cos( hueSpeed - lerpIndex * 4 ),
        -1,
        1,
        360,
        0
      ) / opacityFactor,
      p.map(
        p.sin( hueSpeed - lerpIndex * 4 ),
        -1,
        1,
        128,
        0
      ) / opacityFactor,
      90 / opacityFactor,
      alpha ?? 255
    );
  },
  purple: (
    hueSpeed, lerpIndex, opacityFactor, alpha
  ) => {
    const p = getP5();

    return p.color(
      90 / opacityFactor,
      p.map(
        p.sin( hueSpeed - lerpIndex * 4 ),
        -1,
        1,
        128,
        0
      ) / opacityFactor,
      360 / opacityFactor,
      alpha ?? 255
    );
  },
  pink: (
    _hueSpeed, _lerpIndex, opacityFactor, alpha
  ) => {
    const p = getP5();

    return p.color(
      360 / opacityFactor,
      90 / opacityFactor,
      192 / opacityFactor,
      alpha ?? 255
    );
  },
  red: (
    hueSpeed, lerpIndex, opacityFactor, alpha
  ) => {
    const p = getP5();

    return p.color(
      p.map(
        p.sin( hueSpeed + lerpIndex ),
        -1,
        1,
        255,
        140
      ) / opacityFactor,
      30 / opacityFactor,
      40 / opacityFactor,
      alpha ?? 255
    );
  },
  gold: (
    _hueSpeed, _lerpIndex, opacityFactor, alpha
  ) => {
    const p = getP5();

    return p.color(
      255 / opacityFactor,
      225 / opacityFactor,
      0,
      alpha ?? 255
    );
  },
  ember: (
    hueSpeed, lerpIndex, opacityFactor, alpha
  ) => {
    const p = getP5();

    return p.color(
      p.map(
        p.sin( hueSpeed + lerpIndex ),
        -1,
        1,
        255,
        80
      ) / opacityFactor,
      p.map(
        p.cos( hueSpeed + lerpIndex * 3 ),
        -1,
        1,
        180,
        20
      ) / opacityFactor,
      20 / opacityFactor,
      alpha ?? 255
    );
  },
  ocean: (
    hueSpeed, lerpIndex, opacityFactor, alpha
  ) => {
    const p = getP5();

    return p.color(
      20 / opacityFactor,
      p.map(
        p.sin( hueSpeed + lerpIndex * 3 ),
        -1,
        1,
        200,
        80
      ) / opacityFactor,
      p.map(
        p.cos( hueSpeed + lerpIndex ),
        -1,
        1,
        255,
        140
      ) / opacityFactor,
      alpha ?? 255
    );
  }
};

export const PALETTE_OPTIONS = [
  {
    value: "rainbow",
    label: "Rainbow"
  },
  {
    value: "rainbow-trip",
    label: "Rainbow trip"
  },
  {
    value: "purple",
    label: "Purple"
  },
  {
    value: "pink",
    label: "Pink"
  },
  {
    value: "red",
    label: "Red"
  },
  {
    value: "gold",
    label: "Gold"
  },
  {
    value: "ember",
    label: "Ember"
  },
  {
    value: "ocean",
    label: "Ocean"
  }
];

export function resolvePalette( name ) {
  return palettes[ name ] ?? palettes.rainbow;
}

export function paletteStroke( {
  canvas,
  paletteName,
  hueSpeed,
  lerpIndex,
  opacityFactor,
  alpha
} ) {
  const c = resolvePalette( paletteName )(
    hueSpeed,
    lerpIndex,
    opacityFactor,
    alpha
  );

  canvas.stroke( c );
}

export function computeOpacityFactor( {
  lerpIndex,
  lerpMax,
  time,
  opacityCount,
  opacitySpeed,
  startOpacity,
  endOpacity,
  lineIndex = 0,
  pingPong = false
} ) {
  const p = getP5();

  if ( pingPong ) {
    return p.map(
      p.map(
        p.sin( lerpIndex * opacityCount + time * opacitySpeed + lineIndex ),
        -1,
        1,
        -1,
        1
      ),
      -1,
      1,
      p.map(
        p.cos( lineIndex * opacityCount + time * opacitySpeed ),
        -1,
        1,
        startOpacity * 12,
        1
      ),
      1
    );
  }

  return mappers.circularMap(
    lerpIndex,
    lerpMax * 4,
    p.map(
      p.sin( -time * opacitySpeed + lerpIndex * opacityCount + lineIndex ),
      -1,
      1,
      startOpacity,
      endOpacity
    ),
    endOpacity
  );
}

export function drawWobblyGrid( {
  count, time, strokeColor, weight = 3
} ) {
  const p = getP5();

  p.push();
  p.noFill();
  p.stroke( strokeColor );
  p.strokeWeight( weight );
  p.rectMode( p.CENTER );
  p.translate(
    p.width / 2,
    p.height / 2
  );

  for ( let i = 0; i < count; i++ ) {
    const ra = p.width / count * i * p.sin( time );
    const rb = p.width / count * i * p.cos( time );

    p.rect(
      0,
      0,
      p.width / count * i,
      p.height / count * i,
      Math.abs( ra ),
      Math.abs( rb ),
      Math.abs( ra ),
      Math.abs( rb )
    );
  }
  p.pop();
}

export function drawConcentricCircles( {
  count, time, strokeColor, maxWeight = 50
} ) {
  const p = getP5();

  p.push();
  p.noFill();
  p.translate(
    p.width / 2,
    p.height / 2
  );

  for ( let i = 0; i < count; i++ ) {
    const radius = p.width / count * i;
    const sw = p.map(
      i,
      0,
      count,
      1,
      maxWeight
    );

    p.stroke( strokeColor );
    p.strokeWeight( sw );

    const diameter = ( radius + time * 100 ) % p.width;

    p.ellipse(
      0,
      0,
      diameter,
      diameter
    );
  }
  p.pop();
}

export function drawCartesianGrid( {
  columns, rows, time, strokeColor, weight = 3
} ) {
  const p = getP5();
  const xSize = p.width / columns;
  const ySize = p.height / rows;
  const xx = xSize * p.cos( time + xSize );
  const yy = ySize * p.sin( time + ySize );

  p.push();
  p.stroke( strokeColor );
  p.strokeWeight( weight );

  const offset = -1;

  for ( let x = offset; x <= columns - offset; x++ ) {
    for ( let y = offset; y <= rows - offset; y++ ) {
      p.line(
        0,
        ( yy + y * ySize ) % p.height,
        p.width,
        ( y * ySize + yy ) % p.height
      );
      p.line(
        ( xx + x * xSize ) % p.width,
        0,
        ( xx + x * xSize ) % p.width,
        p.height
      );
    }
  }
  p.pop();
}

export function drawConcentricBackground( {
  count, time, strokeColor
} ) {
  const p = getP5();

  p.push();
  p.noFill();
  p.stroke( strokeColor );
  p.translate(
    p.width / 2,
    p.height / 2
  );

  for ( let i = 0; i < count; i++ ) {
    p.strokeWeight( 1 );

    const d = p.map(
      p.sin( time + i * 0.1 ),
      -1,
      1,
      515,
      p.width * 2.5
    );

    p.circle(
      0,
      0,
      d
    );
  }
  p.pop();
}

export function drawRadialPattern( {
  count,
  time,
  strokeColor,
  innerLerpStep = 0.1,
  strokeWeight = 3,
  radiusXMult = 1.5,
  radiusYMult = 2,
  closed = false
} ) {
  const p = getP5();

  p.push();
  p.stroke( strokeColor );
  p.strokeWeight( strokeWeight );
  p.translate(
    p.width / 2,
    p.height / 2
  );

  const center = p.createVector(
    0,
    0
  );
  const size = p.width + p.height;

  iterators.angle(
    0,
    p.TAU,
    p.TAU / count,
    ( angle ) => {
      const edge = converters.polar.vector(
        angle + time,
        size * ( p.sin( time + angle ) + radiusXMult ),
        size * ( p.cos( time - angle ) + radiusYMult )
      );

      p.beginShape();
      iterators.vector(
        edge,
        center,
        innerLerpStep,
        ( vector ) => {
          p.vertex(
            vector.x,
            vector.y
          );
        }
      );

      if ( closed ) {
        p.endShape( p.CLOSE );
      } else {
        p.endShape();
      }
    }
  );
  p.pop();
}

export function getPaletteSelectField() {
  return {
    component: "select",
    label: "Palette",
    options: PALETTE_OPTIONS
  };
}

export function createPixilatedBuffer( density ) {
  const p = getP5();
  const g = p.createGraphics(
    p.width,
    p.height
  );

  g.pixelDensity( density );

  return g;
}
