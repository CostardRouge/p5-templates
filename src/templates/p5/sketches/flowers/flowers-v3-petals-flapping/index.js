import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";
import colors from "@/p5/utils/colors.js";
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
  // pattern and the lerp-smoothed anchor/times followers below (animation.
  // sequence carries accumulated state, and p5 noise isn't periodic — neither
  // can be made to loop by snapping).
  const rawT = t * timeScale;

  // Hue scroll and flap phase advanced at the raw clock rate — snapped to
  // whole turns per loop.
  const windTurns = Math.round( timeScale );
  const tt = t * windTurns;

  // ── Dense background grid ─────────────────────────────────────────
  const bgEnabled = options.sketch.background?.enabled ?? true;

  if ( bgEnabled ) {
    const columns = options.sketch.background?.columns ?? 20;
    const rows = options.sketch.background?.rows ?? 25;
    const cellW = p.width / columns;
    const cellH = p.height / rows;
    const bgPalette = resolvePalette( options.sketch.background?.palette ?? "purple" );
    const bgPattern = options.sketch.background?.sidesPattern ?? [
      0,
      1,
      2,
      4
    ];
    const bgHueIndexMultiplier = options.sketch.background?.hueIndexMultiplier ?? 2;
    const bgOpacity = options.sketch.background?.opacityFactor ?? 3.5;
    const bgBorderWidth = options.sketch.background?.borderWidth ?? 3;
    const bgSize = options.sketch.background?.size ?? 10;

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
            ) * bgHueIndexMultiplier,
            opacityFactor: bgOpacity
          } ),
          borderWidth: bgBorderWidth,
          size: bgSize
        } );
      }
    );
  }

  // ── Animated 3-anchor diagonal path ───────────────────────────────
  const boundary = options.sketch.path?.boundary ?? 250;
  const anchorSpeed = options.sketch.path?.anchorSpeed ?? 0.33;
  const anchorLerpAmount = options.sketch.path?.anchorLerpAmount ?? 0.1;

  // Lerp-smoothed followers (animation.sequence carries accumulated state
  // across frames) — not fixable by snapping, kept on the raw clock.
  const start = animation.sequence(
    "flowers-v3-start",
    rawT * anchorSpeed,
    [
      p.createVector(
        boundary,
        boundary
      ),
      p.createVector(
        p.width / 2,
        p.height / 4
      ),
      p.createVector(
        p.width - boundary,
        boundary
      )
    ],
    anchorLerpAmount,
    mappers.lerpVector
  );
  const end = animation.sequence(
    "flowers-v3-end",
    rawT * anchorSpeed,
    [
      p.createVector(
        p.width - boundary,
        p.height - boundary
      ),
      p.createVector(
        p.width / 2,
        p.height - boundary
      ),
      p.createVector(
        boundary,
        p.height - boundary
      )
    ],
    anchorLerpAmount,
    mappers.lerpVector
  );

  const pathStep = options.sketch.path?.step ?? 1 / 384;
  const sides = options.sketch.foreground?.sides ?? 1;
  const timesSeq = options.sketch.foreground?.timesSequence ?? [
    1,
    3,
    5
  ];
  const timesLerpAmount = options.sketch.foreground?.timesLerpAmount ?? 0.0001;
  const sizeMin = options.sketch.foreground?.sizeMin ?? 1;
  const sizeMax = options.sketch.foreground?.sizeMax ?? 250;
  const borderWidth = options.sketch.foreground?.borderWidth ?? 70;
  const flapAmplitude = options.sketch.foreground?.flapAmplitude ?? 1;
  const palette = resolvePalette( options.sketch.foreground?.palette ?? "rainbow" );
  const hueIndexMultiplier = options.sketch.foreground?.hueIndexMultiplier ?? 4;
  const opacityMax = options.sketch.foreground?.opacityMax ?? 5;
  const opacityMin = options.sketch.foreground?.opacityMin ?? 1;

  // Foreground rotation — its own rate on top of the raw clock, snapped to
  // whole turns per loop.
  const rotationTurns = Math.round( ( options.sketch.foreground?.rotationSpeed ?? 0.5 ) * timeScale );

  iterators.vector(
    start,
    end,
    pathStep,
    (
      vector, lerpIndex
    ) => {
      // Lerp-smoothed follower (animation.sequence carries accumulated state
      // across frames) — not fixable by snapping, kept on the raw clock. The
      // size ratio, cross size and opacity below derive from it, so they
      // remain non-looping too.
      const times = animation.sequence(
        "flowers-v3-times",
        rawT / 3,
        timesSeq,
        timesLerpAmount
      );
      const sizeRatio = mappers.fn(
        lerpIndex,
        0,
        1,
        -p.PI,
        p.PI
      ) * times;
      const crossSize = mappers.fn(
        p.cos( sizeRatio ),
        -1,
        1,
        sizeMin,
        sizeMax
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
      p.rotate( -t * rotationTurns );
      p.rotate( mappers.fn(
        p.sin( lerpIndex + tt ),
        -1,
        1,
        0,
        p.PI * 2
      ) * flapAmplitude );

      cross( {
        sides,
        borderColor: fgColor,
        borderWidth,
        size: crossSize,
        depth: 1,
        recursive: true
      } );
      p.pop();
    }
  );

  renderTitle();
} );
