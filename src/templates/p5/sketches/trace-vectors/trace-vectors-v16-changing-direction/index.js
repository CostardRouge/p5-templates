import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import iterators from "@/p5/utils/iterators.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  getAlphabet, getFont, loopedTime
} from "../_shared.js";
import {
  renderGridTraceCommon
} from "../_grid-trace.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

let gt = 0;

function cross(
  p, {
    x, y
  }, size
) {
  p.line(
    x - size / 2,
    y - size / 2,
    x + size / 2,
    y + size / 2
  );
  p.line(
    x + size / 2,
    y - size / 2,
    x - size / 2,
    y + size / 2
  );
}

function traceLine(
  p, start, end, range, progression
) {
  const [
    _rangeStart,
    _rangeMin,
    _rangeEnd
  ] = range;
  const rangeStart = mappers.lerpVector(
    start,
    end,
    _rangeStart
  );
  const rangeMin = mappers.lerpVector(
    start,
    end,
    _rangeMin
  );
  const rangeEnd = mappers.lerpVector(
    start,
    end,
    _rangeEnd
  );
  const final = mappers.lerpVector(
    rangeMin,
    rangeEnd,
    progression
  );

  cross(
    p,
    rangeMin,
    20
  );
  cross(
    p,
    rangeEnd,
    20
  );
  cross(
    p,
    rangeStart,
    20
  );

  p.line(
    rangeStart.x,
    rangeStart.y,
    final.x,
    final.y
  );
}

sketch.draw( (
  _t, center, favoriteColor
) => {
  const p = getP5();

  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );
  p.noFill();

  const time = loopedTime();

  const directionSpeed = options.sketch.direction?.speed ?? 0.025;
  const direction = mappers.fn(
    p.sin( time / 2 ),
    -1,
    1,
    -directionSpeed,
    directionSpeed,
    easing.easeInOutElastic
  );
  const directionNormalized = p.map(
    direction,
    -directionSpeed,
    directionSpeed,
    0,
    1
  );

  gt += direction;

  const W = p.width / 2;
  const H = p.height / 2;
  const redish = p.color(
    255,
    64,
    64
  );
  const directionColor = p.lerpColor(
    favoriteColor,
    redish,
    p.map(
      Math.abs( direction ),
      0,
      directionSpeed,
      0,
      1
    )
  );

  if ( options.sketch.hud?.show ) {
    p.push();
    p.strokeWeight( options.sketch.hud?.weight ?? 1 );
    p.stroke( directionColor );

    const margin = options.sketch.hud?.margin ?? 50;
    const _start = p.createVector(
      -W + margin,
      H - margin
    );
    const _end = p.createVector(
      W - margin,
      H - margin
    );

    traceLine(
      p,
      _start,
      _end,
      options.sketch.hud?.range ?? [
        0.5,
        0,
        1
      ],
      directionNormalized
    );

    p.stroke( 255 );
    p.beginShape();
    iterators.vectors(
      [
        _start,
        _end
      ],
      ( {
        x, y
      } ) => p.point(
        x,
        y
      ),
      0.1
    );
    p.endShape();
    p.pop();
  }

  const text = getAlphabet( "123456789" );
  const font = getFont( options.sketch.textStyle?.font );

  const accentMix = p.map(
    Math.abs( direction ),
    0,
    directionSpeed,
    0,
    1
  );
  const redAccent = p.color(
    255,
    16,
    16
  );

  renderGridTraceCommon( {
    opts: options.sketch,
    favoriteColor,
    center,
    font,
    text,
    alphabet: text,
    time: gt,
    positionTime: gt,
    positionTimeOffset: 0,
    colorAccent: directionColor,
    accentMix: 0,
    chunkColor: ( {
      p: pp, opts, chunkIndex, vectorIndexProgression
    } ) => {
      const baseColor = colors.rainbow( {
        hueOffset: opts.colors?.hueOffset ?? 0,
        hueIndex:
          mappers.fn(
            pp.noise(
              chunkIndex,
              vectorIndexProgression * 2
            ),
            0,
            1,
            -pp.PI / 2,
            pp.PI / 2
          ) * ( opts.colors?.hueIndexMultiplier ?? 16 ),
        opacityFactor: mappers.fn(
          pp.noise(
            chunkIndex,
            vectorIndexProgression
          ),
          0,
          1,
          opts.colors?.opacityMax ?? 2.5,
          opts.colors?.opacityMin ?? 1.5
        )
      } );

      return pp.lerpColor(
        baseColor,
        redAccent,
        accentMix
      );
    }
  } );

  renderTitle();
} );
