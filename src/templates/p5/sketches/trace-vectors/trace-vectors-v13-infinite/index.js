import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
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

  renderTitle();
} );
