import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import iterators from "@/p5/utils/iterators.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  cross
} from "@/p5/sketches/flowers/_cross.js";

const PALETTES = {
  rainbow: colors.rainbow,
  rainbowCrazy: colors.rainbowCrazy,
  purple: colors.purple,
  purpleSimple: colors.purpleSimple,
  darkBlueYellow: colors.darkBlueYellow,
  green: colors.green,
  black: colors.black
};

const resolvePalette = ( name ) => PALETTES[ name ] ?? colors.rainbow;

const easingFunctions = Object.entries( easing );

sketch.setup( () => {} );

sketch.draw( async() => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const timeScale = options.sketch.timeScale ?? 1;

  // ── Loop-exact clock ─────────────────────────────────────────────────────
  // animation.angle sweeps exactly TAU per loop, so the loop seam is invisible
  // only when every time-driven rate completes a WHOLE number of cycles per
  // loop. Each raw slider rate (× time scale) is therefore rounded to whole
  // cycles below — fractional rates are what made the last frame disagree with
  // the first.
  const t = animation.angle;

  // Raw (unsnapped) scaled clock — kept only for the noise-scrubbed grid glyph
  // pattern and the lerp-smoothed `amt` follower below. Neither can be made to
  // loop by snapping (p5 noise isn't periodic, animation.sequence carries
  // accumulated lerp state), so they keep the original raw-clock behavior.
  const rawT = t * timeScale;

  // Hue scroll (background + foreground) advanced at the raw clock rate —
  // snapped to whole turns per loop.
  const windTurns = Math.round( timeScale );
  const tt = t * windTurns;

  // ── Background grid of mini-crosses ──────────────────────────────
  const bgEnabled = options.sketch.background?.enabled ?? true;

  if ( bgEnabled ) {
    const columns = options.sketch.background?.columns ?? 30;
    const rows = options.sketch.background?.rows ?? 50;
    const cellWidth = p.width / columns;
    const cellHeight = p.height / rows;

    const bgSidesPattern = options.sketch.background?.sidesPattern ?? [
      0,
      1,
      2,
      3,
      4,
      3,
      2,
      1
    ];
    const bgPalette = resolvePalette( options.sketch.background?.palette ?? "purple" );
    const bgOpacity = options.sketch.background?.opacityFactor ?? 4.5;
    const bgBorderWidth = options.sketch.background?.borderWidth ?? 2;
    const bgSize = options.sketch.background?.size ?? 25;

    await grid.draw(
      {
        topLeft: p.createVector(
          0,
          0
        ),
        topRight: p.createVector(
          p.width,
          0
        ),
        bottomLeft: p.createVector(
          0,
          p.height
        ),
        bottomRight: p.createVector(
          p.width,
          p.height
        ),
        rows,
        columns
      },
      (
        position, {
          x, y
        }
      ) => {
        const xOff = x / columns;
        const yOff = y / rows;
        // Noise-scrubbed glyph pattern — p5 noise isn't periodic, so this
        // can't be made to close the loop by snapping; kept on the raw clock.
        const sides = mappers.circularIndex(
          rawT + p.noise(
            yOff + rawT,
            xOff
          ),
          bgSidesPattern
        );

        cross( {
          position: p.createVector(
            position.x + cellWidth / 2,
            position.y + cellHeight / 2
          ),
          sides,
          borderColor: bgPalette( {
            hueOffset: tt + p.sin( y + tt ),
            hueIndex: mappers.fn(
              x,
              0,
              columns - 1,
              -p.PI,
              p.PI
            ),
            opacityFactor: bgOpacity
          } ),
          borderWidth: bgBorderWidth,
          size: bgSize
        } );
      }
    );
  }

  // ── Foreground path of large crosses ─────────────────────────────
  const boundary = options.sketch.path?.boundary ?? 75;
  const start = p.createVector(
    p.width / 2,
    boundary
  );
  const end = p.createVector(
    p.width / 2,
    p.height - boundary
  );

  const pathStep = options.sketch.path?.step ?? 1 / 512;
  const sidesValues = options.sketch.foreground?.sidesValues ?? [
    1,
    2,
    3,
    6,
    9
  ];
  const fgBorderWidth = options.sketch.foreground?.borderWidth ?? 75;
  const fgSizeMin = options.sketch.foreground?.sizeMin ?? 1;
  const fgSizeMax = options.sketch.foreground?.sizeMax ?? 250;
  const fgOpacityMax = options.sketch.foreground?.opacityMax ?? 3;
  const fgOpacityMin = options.sketch.foreground?.opacityMin ?? 1;
  const fgHueIndexMultiplier = options.sketch.foreground?.hueIndexMultiplier ?? 4;
  const paletteA = resolvePalette( options.sketch.foreground?.paletteA ?? "rainbow" );
  const paletteB = resolvePalette( options.sketch.foreground?.paletteB ?? "purple" );

  // Foreground rotation — its own rate on top of the raw clock, snapped to
  // whole turns per loop.
  const rotationTurns = Math.round( ( options.sketch.foreground?.rotationSpeed ?? 0.2 ) * timeScale );

  // The easing-function and palette pickers below walk a circular list via
  // mappers.circularIndex, so each only returns to its starting entry after a
  // whole number of list cycles per loop — snap their own clocks accordingly.
  const easingCycles = Math.round( ( timeScale * p.TAU ) / easingFunctions.length );
  const easingClock = animation.progression * easingCycles * easingFunctions.length;
  const paletteCycles = Math.round( ( timeScale * p.TAU ) / 2 );
  const paletteClock = animation.progression * paletteCycles * 2;

  iterators.vector(
    start,
    end,
    pathStep,
    (
      vector, lerpIndex
    ) => {
      const easingFunction = mappers.circularIndex(
        lerpIndex + easingClock,
        easingFunctions
      )[ 1 ];

      const colorFunction = mappers.circularIndex(
        paletteClock + lerpIndex,
        [
          paletteA,
          paletteB
        ]
      );

      const s = mappers.fn(
        lerpIndex,
        0,
        1,
        -p.PI,
        p.PI,
        easingFunction
      );
      const ss = mappers.fn(
        p.cos( s ),
        -1,
        1,
        fgSizeMin,
        fgSizeMax
      );
      // Lerp-smoothed follower (animation.sequence carries accumulated state
      // across frames) — not fixable by snapping, kept on the raw clock.
      const amt = animation.sequence(
        "flowers-v0-amt",
        rawT + lerpIndex,
        sidesValues
      );

      const fgColor = colorFunction( {
        hueOffset: tt,
        hueIndex: mappers.fn(
          lerpIndex,
          0,
          1,
          -p.PI,
          p.PI
        ) * fgHueIndexMultiplier,
        opacityFactor: mappers.fn(
          p.cos( s ),
          -1,
          1,
          fgOpacityMax,
          fgOpacityMin
        )
      } );

      p.push();
      p.translate(
        vector.x,
        vector.y
      );
      p.rotate( t * rotationTurns + mappers.fn(
        lerpIndex,
        0,
        1,
        0,
        p.PI
      ) );

      cross( {
        sides: amt,
        borderColor: fgColor,
        borderWidth: fgBorderWidth,
        size: ss
      } );
      p.pop();
    }
  );

  renderTitle();
} );
