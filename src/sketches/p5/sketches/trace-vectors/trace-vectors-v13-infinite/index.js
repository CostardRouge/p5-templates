import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import {
  getAlphabet, getFont, loopedTime
} from "../_shared.js";
import {
  renderGridTraceCommon
} from "../_grid-trace.js";
import {
  paintBackground,
  resolveBackground
} from "@/p5/utils/background.js";

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

  p.clear();
  paintBackground( resolveBackground(
    options.sketch.backgroundColor,
    {
      fallback: [
        0
      ],
      palette: options.sketch.colors?.palette
    }
  ) );
  p.noFill();

  const time = loopedTime();
  const text = getAlphabet( "#infinite" );
  const font = getFont( options.sketch.textStyle?.font );

  renderGridTraceCommon( {
    opts: options.sketch,
    favoriteColor,
    center,
    font,
    text,
    alphabet: text,
    time
  } );
} );
