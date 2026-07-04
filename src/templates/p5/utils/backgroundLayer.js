import options from "./options.js";

/**
 * Opt-in engine ownership of a sketch's background, so "back"-phase content
 * items (drawn before the sketch — see freeLayout) stay visible under it.
 *
 * The problem: most sketches open their draw with an opaque p.background(),
 * which repaints the whole canvas and erases anything rendered before the
 * sketch. With `delegateBackground: true` in a template's sketch settings,
 * the FIRST opaque background() call inside the sketch's draw is captured
 * instead of painted; the engine repaints that color at the very bottom of
 * the next frame (paintBase, before back-phase items). Translucent calls
 * (alpha < 255 — trail/accumulation effects) and any further opaque calls in
 * the same frame (intentional mid-frame repaints) pass through untouched.
 *
 * Designed for 2D sketches whose draw starts with an opaque background().
 * Sketches that clear() manually or accumulate without a background call
 * should keep the flag off.
 */

const state = {
  original: null,
  baseArgs: null,
  inSketchDraw: false,
  consumed: false
};

export function isDelegated() {
  return options.sketch?.delegateBackground === true;
}

// Best-effort alpha detection over p5's background() signatures. Anything not
// recognizably translucent (color strings, p5.Color, single gray, r/g/b) is
// treated as opaque.
function alphaOf( args ) {
  if ( args.length === 1 && Array.isArray( args[ 0 ] ) ) {
    return args[ 0 ][ 3 ] ?? 255;
  }

  if ( args.length === 2 && typeof args[ 0 ] === "number" && typeof args[ 1 ] === "number" ) {
    return args[ 1 ];
  }

  if ( args.length === 4 && typeof args[ 3 ] === "number" ) {
    return args[ 3 ];
  }

  return 255;
}

// Called from p.setup on every fresh p5 instance — always rebinds so a reset
// never leaves the wrapper pointing at a destroyed instance.
export function install( p ) {
  state.original = p.background.bind( p );
  state.baseArgs = null;
  state.inSketchDraw = false;
  state.consumed = false;

  p.background = ( ...args ) => {
    if ( !state.inSketchDraw || !isDelegated() ) {
      return state.original( ...args );
    }

    if ( alphaOf( args ) < 255 ) {
      return state.original( ...args );
    }

    if ( !state.consumed ) {
      state.consumed = true;
      state.baseArgs = args;
      return;
    }

    return state.original( ...args );
  };
}

export function beginSketchDraw() {
  state.inSketchDraw = true;
  state.consumed = false;
}

export function endSketchDraw() {
  state.inSketchDraw = false;
}

// Repaint the captured base color at the bottom of the frame (pre-draw, after
// the engine clear, before back-phase content). No-op until the sketch's
// first draw has captured a color — one transparent frame at load.
export function paintBase() {
  if ( !isDelegated() || !state.baseArgs || !state.original ) {
    return;
  }

  state.original( ...state.baseArgs );
}
