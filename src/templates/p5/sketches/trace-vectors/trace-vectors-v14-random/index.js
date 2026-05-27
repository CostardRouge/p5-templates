import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
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

sketch.draw( (
  _t, center, favoriteColor
) => {
  const p = getP5();

  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );
  p.noFill();

  const time = loopedTime();
  const text = getAlphabet( "#random()" );
  const font = getFont( options.sketch.textStyle?.font );
  const letterFont = getFont( options.sketch.textStyle?.font ?? "sans" );

  renderGridTraceCommon( {
    opts: {
      ...options.sketch,
      trajectory: {
        ...( options.sketch.trajectory ?? {} ),
        random: options.sketch.trajectory?.random ?? true
      }
    },
    favoriteColor,
    center,
    font,
    letterFont,
    text,
    alphabet: text,
    time,
    positionEasing: easing.easeInOutBack,
    chunkColor: ( {
      p: pp, time: t, opts, chunkIndex, vectorIndexProgression
    } ) => colors.test( {
      hueOffset: t + chunkIndex + ( opts.colors?.hueOffset ?? 0 ),
      hueIndex:
        mappers.fn(
          pp.noise(
            chunkIndex,
            vectorIndexProgression * 4
          ),
          0,
          1,
          -pp.PI / 2,
          pp.PI / 2
        ) * ( opts.colors?.hueIndexMultiplier ?? 2 ),
      opacityFactor: mappers.fn(
        pp.noise(
          chunkIndex * 2 + t,
          vectorIndexProgression * 4
        ),
        0,
        1,
        opts.colors?.opacityMax ?? 2.5,
        opts.colors?.opacityMin ?? 1.5
      )
    } )
  } );

  renderTitle();
} );
