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

sketch.setup( () => {} );

sketch.draw( async() => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const timeScale = options.sketch.timeScale ?? 10;

  // ── Loop-exact clock ─────────────────────────────────────────────────────
  // animation.angle sweeps exactly TAU per loop, so the loop seam is invisible
  // only when every time-driven rate completes a WHOLE number of cycles per
  // loop. Each raw slider rate (× time scale) is therefore rounded to whole
  // cycles below — fractional rates are what made the last frame disagree with
  // the first.
  const t = animation.angle;

  // Raw (unsnapped) scaled clock — kept only for the noise-scrubbed background
  // pattern and the lerp-smoothed anchor/sides followers below (animation.
  // sequence carries accumulated state, and p5 noise isn't periodic — neither
  // can be made to loop by snapping).
  const rawT = t * timeScale;

  // ── Background mini-recursive crosses ────────────────────────────
  const bgEnabled = options.sketch.background?.enabled ?? true;

  if ( bgEnabled ) {
    const columns = options.sketch.background?.columns ?? 6;
    const rows = options.sketch.background?.rows ?? 10;
    const cellW = p.width / columns;
    const cellH = p.height / rows;
    const bgPalette = resolvePalette( options.sketch.background?.palette ?? "rainbow" );
    const bgPattern = options.sketch.background?.sidesPattern ?? [
      0,
      2,
      3,
      4
    ];
    const bgOpacity = options.sketch.background?.opacityFactor ?? 2;
    const bgBorderWidth = options.sketch.background?.borderWidth ?? 3;
    const bgSize = options.sketch.background?.size ?? 30;

    p.push();
    p.translate(
      cellW / 2,
      cellH / 2
    );
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
          size: bgSize,
          recursive: true,
          depth: 1
        } );
      }
    );
    p.pop();
  }

  // ── Animated start/end across 3 anchor positions ─────────────────
  const boundary = options.sketch.path?.boundary ?? 250;
  const seqSpeed = options.sketch.path?.anchorSpeed ?? 0.66;
  const seqAmount = options.sketch.path?.anchorLerpAmount ?? 0.1;

  // Lerp-smoothed followers (animation.sequence carries accumulated state
  // across frames) — not fixable by snapping, kept on the raw clock.
  const start = animation.sequence(
    "flowers-v2-start",
    rawT * seqSpeed,
    [
      p.createVector(
        boundary,
        boundary
      ),
      p.createVector(
        p.width - boundary,
        boundary
      ),
      p.createVector(
        p.width / 2,
        p.height / 4
      )
    ],
    seqAmount,
    mappers.lerpVector
  );
  const end = animation.sequence(
    "flowers-v2-end",
    rawT * seqSpeed,
    [
      p.createVector(
        p.width - boundary,
        p.height - boundary
      ),
      p.createVector(
        boundary,
        p.height - boundary
      ),
      p.createVector(
        p.width / 2,
        p.height - boundary
      )
    ],
    seqAmount,
    mappers.lerpVector
  );

  const pathStep = options.sketch.path?.step ?? 1 / 512;

  const sidesSeq = options.sketch.foreground?.sidesSequence ?? [
    2,
    3,
    4,
    2
  ];
  const timesValues = options.sketch.foreground?.timesValues ?? [
    3,
    5
  ];
  const sidesMin = options.sketch.foreground?.sidesMin ?? 2;
  const sidesMax = options.sketch.foreground?.sidesMax ?? 5;
  const borderWidthMin = options.sketch.foreground?.borderWidthMin ?? 20;
  const borderWidthMax = options.sketch.foreground?.borderWidthMax ?? 80;
  const sizeMaxMin = options.sketch.foreground?.sizeMaxMin ?? 150;
  const sizeMax = options.sketch.foreground?.sizeMax ?? 250;
  const hueIndexMultiplier = options.sketch.foreground?.hueIndexMultiplier ?? 4;
  const opacityMax = options.sketch.foreground?.opacityMax ?? 3;
  const opacityMin = options.sketch.foreground?.opacityMin ?? 1.1;
  const opacitySinFactor = options.sketch.foreground?.opacitySinFactor ?? 3;

  // Foreground rotation — its own rate on top of the raw clock, snapped to
  // whole turns per loop.
  const rotationTurns = Math.round( ( options.sketch.foreground?.rotationSpeed ?? 0.5 ) * timeScale );

  // The `times` picker walks a circular list via mappers.circularIndex, so it
  // only returns to its starting entry after a whole number of list cycles
  // per loop — snap its own clock accordingly.
  const timesCycles = Math.round( ( timeScale * p.TAU ) / timesValues.length );
  const timesClock = animation.progression * timesCycles * timesValues.length;

  // sin(opacitySinFactor * animation.sinAngle) — sinAngle is (angle - PI) / 2,
  // so this term's effective rate is opacitySinFactor / 2 turns of
  // animation.angle per loop; snap that to a whole number of turns.
  const opacityTurns = Math.round( opacitySinFactor / 2 );

  iterators.vector(
    start,
    end,
    pathStep,
    (
      vector, lerpIndex
    ) => {
      // Lerp-smoothed follower (animation.sequence carries accumulated state
      // across frames) — not fixable by snapping, kept on the raw clock. The
      // border width, size cap and cross size below derive from it, so they
      // remain non-looping too.
      const sides = animation.sequence(
        "flowers-v2-amt",
        rawT + lerpIndex,
        sidesSeq
      );
      const times = mappers.circularIndex(
        lerpIndex + timesClock,
        timesValues
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
        p.PI
      ) * times;
      const crossSize = mappers.fn(
        p.cos( sizeRatio ),
        -1,
        1,
        1,
        maxSize
      );

      p.push();
      p.translate(
        vector.x,
        vector.y
      );
      p.rotate( -t * rotationTurns );
      p.rotate( mappers.circularIndex(
        lerpIndex * times,
        [
          0,
          180
        ]
      ) );

      cross( {
        sides,
        borderColor: ( recursionIndex ) => colors.rainbow( {
          hueIndex: mappers.fn(
            lerpIndex,
            0,
            1,
            -p.PI,
            p.PI
          ) * hueIndexMultiplier,
          opacityFactor: mappers.fn(
            p.sin( opacityTurns * ( t - p.PI ) + lerpIndex * 15 + recursionIndex / 50 ),
            -1,
            1,
            opacityMax,
            opacityMin
          )
        } ),
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
