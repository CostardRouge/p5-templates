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

  // Raw (unsnapped) scaled clock — kept only for the noise-scrubbed background
  // pattern below, which can't be made to loop by snapping (p5 noise isn't
  // periodic).
  const rawT = t * timeScale;

  // Hue scroll advanced at the raw clock rate — snapped to whole turns per
  // loop.
  const windTurns = Math.round( timeScale );
  const tt = t * windTurns;

  // ── Background sparse pattern ────────────────────────────────────
  const bgEnabled = options.sketch.background?.enabled ?? true;

  if ( bgEnabled ) {
    const columns = options.sketch.background?.columns ?? 7;
    const rows = options.sketch.background?.rows ?? 12;
    const cellW = p.width / columns;
    const cellH = p.height / rows;

    const bgPalette = resolvePalette( options.sketch.background?.palette ?? "purple" );
    const bgPattern = options.sketch.background?.sidesPattern ?? [
      0,
      1,
      2,
      4
    ];
    const bgOpacity = options.sketch.background?.opacityFactor ?? 3.5;
    const bgBorderWidth = options.sketch.background?.borderWidth ?? 3;
    const bgSize = options.sketch.background?.size ?? 15;

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
        // Noise-scrubbed glyph pattern and hue — p5 noise isn't periodic, so
        // neither can be made to close the loop by snapping; kept on the raw
        // clock.
        const sides = mappers.circularIndex(
          rawT / 2 + p.noise(
            yOff + rawT,
            xOff
          ),
          bgPattern
        );

        cross( {
          position: p.createVector(
            position.x + cellW / 2,
            position.y + cellH / 2
          ),
          sides,
          borderColor: bgPalette( {
            hueOffset: rawT + p.noise(
              yOff + rawT,
              xOff + rawT
            ),
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

  // ── Foreground recursive crosses on vertical path ────────────────
  const boundary = options.sketch.path?.boundary ?? 150;
  const start = p.createVector(
    p.width / 2,
    boundary
  );
  const end = p.createVector(
    p.width / 2,
    p.height - boundary
  );
  const pathStep = options.sketch.path?.step ?? 1 / 512;

  const sidesSeq = options.sketch.foreground?.sidesSequence ?? [
    2,
    3,
    4,
    5,
    4,
    3
  ];
  const sidesMin = options.sketch.foreground?.sidesMin ?? 2;
  const sidesMax = options.sketch.foreground?.sidesMax ?? 6;
  const borderWidthMin = options.sketch.foreground?.borderWidthMin ?? 20;
  const borderWidthMax = options.sketch.foreground?.borderWidthMax ?? 70;
  const sizeMax = options.sketch.foreground?.sizeMax ?? 400;
  const sizeMaxMin = options.sketch.foreground?.sizeMaxMin ?? 150;
  const recursionDepth = options.sketch.foreground?.recursionDepth ?? 1;
  const palette = resolvePalette( options.sketch.foreground?.palette ?? "rainbow" );
  const hueIndexMultiplier = options.sketch.foreground?.hueIndexMultiplier ?? 4;
  const opacityMax = options.sketch.foreground?.opacityMax ?? 5;
  const opacityMin = options.sketch.foreground?.opacityMin ?? 1;

  // Foreground rotation — its own rate on top of the raw clock, snapped to
  // whole turns per loop.
  const rotationTurns = Math.round( ( options.sketch.foreground?.rotationSpeed ?? 1 ) * timeScale );

  // The easing-function picker walks a circular list via mappers.circularIndex,
  // so it only returns to its starting entry after a whole number of list
  // cycles per loop — snap its own clock accordingly.
  const easingCycles = Math.round( ( timeScale * p.TAU ) / easingFunctions.length );
  const easingClock = animation.progression * easingCycles * easingFunctions.length;

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

      // Lerp-smoothed follower (animation.sequence carries accumulated state
      // across frames) — not fixable by snapping, kept on the raw clock. The
      // border width, size cap and cross size below derive from it, so they
      // remain non-looping too.
      const sides = animation.sequence(
        "flowers-v1-amt",
        rawT + lerpIndex,
        sidesSeq
      );
      const borderWidth = mappers.fn(
        sides,
        sidesMin,
        sidesMax,
        borderWidthMax,
        borderWidthMin
      );
      const maxSize = mappers.fn(
        sides,
        sidesMin,
        sidesMax,
        sizeMaxMin,
        sizeMax
      );
      const sizeRatio = mappers.fn(
        lerpIndex,
        0,
        1,
        -p.PI,
        p.PI,
        easingFunction
      );
      const crossSize = mappers.fn(
        p.cos( sizeRatio ),
        -1,
        1,
        1,
        maxSize
      );

      const fgColor = palette( {
        hueOffset: tt,
        hueIndex: mappers.fn(
          lerpIndex,
          0,
          1,
          -p.PI,
          p.PI
        ) * hueIndexMultiplier,
        opacityFactor: mappers.fn(
          p.cos( sizeRatio + tt ),
          -1,
          1,
          opacityMax,
          opacityMin
        )
      } );

      p.push();
      p.translate(
        vector.x,
        vector.y
      );
      p.rotate( t * rotationTurns );
      p.rotate( mappers.fn(
        lerpIndex,
        0,
        1,
        0,
        p.PI
      ) );

      cross( {
        sides,
        borderColor: fgColor,
        borderWidth,
        size: crossSize,
        depth: recursionDepth,
        recursive: true
      } );
      p.pop();
    }
  );

  renderTitle();
} );
