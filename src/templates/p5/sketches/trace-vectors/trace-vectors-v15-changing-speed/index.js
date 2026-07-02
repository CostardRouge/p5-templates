import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import iterators from "@/p5/utils/iterators.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  getAlphabet, getFont, loopedPhase
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

// Unbounded drift accumulator (never resets to `progression`) — the position
// walk it drives (passed to renderGridTraceCommon as time/positionTime below)
// cannot be made loop-safe by rounding.
let gt = 3.5;

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

sketch.draw( (
  _t, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );
  p.noFill();

  const speedValues = options.sketch.speed?.values ?? [
    0.01,
    0.01,
    0.025,
    0.05,
    0.05,
    0.075,
    0.1,
    0.1,
    0.1,
    0.05
  ];

  // Loop-exact speed cycle — whole `speedValues`-length cycles per loop
  // (this closes `speed` itself, which the HUD and hue below derive from;
  // `gt`, which accumulates `speed` every frame and never resets, is a
  // separate unbounded drift term that stays unfixed further down).
  const speed = animation.ease( {
    values: speedValues,
    duration: 1,
    easingFn: easing.easeInOutBack,
    currentTime: loopedPhase(
      1,
      speedValues.length
    )
  } );

  gt += speed;

  const W = p.width / 2;
  const H = p.height / 2;

  const speedMin = Math.min( ...speedValues );
  const speedMax = Math.max( ...speedValues );
  const speedNormalized = p.map(
    speed,
    speedMin,
    speedMax,
    0,
    1
  );

  const redish = p.color(
    255,
    64,
    64
  );
  const speedColor = p.lerpColor(
    favoriteColor,
    redish,
    p.map(
      speedNormalized,
      0,
      1,
      0,
      0.75
    )
  );

  if ( options.sketch.hud?.show ) {
    p.push();
    p.strokeWeight( options.sketch.hud?.weight ?? 1 );
    const margin = options.sketch.hud?.margin ?? 50;
    const _start = p.createVector(
      -W + margin,
      H - margin
    );
    const _end = p.createVector(
      -W + margin,
      -H + margin
    );
    const final = p.createVector(
      p.lerp(
        _start.x,
        _end.x,
        speedNormalized
      ),
      p.lerp(
        _start.y,
        _end.y,
        speedNormalized
      )
    );

    p.stroke( speedColor );
    p.line(
      _start.x,
      _start.y,
      final.x,
      final.y
    );

    cross(
      p,
      _start,
      20
    );
    cross(
      p,
      _end,
      20
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

  const text = getAlphabet( "#elastic!" );
  const font = getFont( options.sketch.textStyle?.font );

  const accentMix = p.map(
    speed,
    speedMin,
    speedMax,
    0,
    options.sketch.colors?.accentMixMax ?? 0.5
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
    colorAccent: speedColor,
    accentMix: 0,
    chunkColor: ( {
      p: pp, opts, chunkIndex, vectorIndexProgression
    } ) => {
      const baseColor = colors.rainbow( {
        hueOffset: speed + ( opts.colors?.hueOffset ?? 0 ),
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
