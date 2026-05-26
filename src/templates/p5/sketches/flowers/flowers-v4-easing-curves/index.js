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

  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle * ( options.sketch.timeScale ?? 1 );

  // ── Background sparse grid ────────────────────────────────────────
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
        const sides = mappers.circularIndex(
          t / 2 + p.noise(
            yOff + t,
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
            hueOffset: t + p.noise(
              yOff + t,
              xOff + t
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

  // ── Foreground easing curves between 2 animated anchors ──────────
  const boundary = options.sketch.path?.boundary ?? 250;
  const anchorSpeed = options.sketch.path?.anchorSpeed ?? 0.5;
  const anchorLerpAmount = options.sketch.path?.anchorLerpAmount ?? 0.1;

  const start = animation.sequence(
    "flowers-v4-start",
    t * anchorSpeed,
    [
      p.createVector(
        boundary,
        boundary
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
    "flowers-v4-end",
    t * anchorSpeed,
    [
      p.createVector(
        p.width - boundary,
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

  const pathStep = options.sketch.path?.step ?? 1 / 256;
  const sides = options.sketch.foreground?.sides ?? 1;
  const times = options.sketch.foreground?.times ?? 1;
  const sizeMin = options.sketch.foreground?.sizeMin ?? 1;
  const sizeMax = options.sketch.foreground?.sizeMax ?? 250;
  const borderWidth = options.sketch.foreground?.borderWidth ?? 70;
  const palette = resolvePalette( options.sketch.foreground?.palette ?? "rainbow" );
  const hueIndexMultiplier = options.sketch.foreground?.hueIndexMultiplier ?? 4;
  const opacityMax = options.sketch.foreground?.opacityMax ?? 5;
  const opacityMin = options.sketch.foreground?.opacityMin ?? 1;

  iterators.vector(
    start,
    end,
    pathStep,
    (
      vector, lerpIndex
    ) => {
      const easingFunction = mappers.circularIndex(
        t + lerpIndex,
        easingFunctions
      )[ 1 ];

      const sizeRatio = mappers.fn(
        lerpIndex,
        0,
        1,
        -p.PI,
        p.PI,
        easingFunction
      ) * times;
      const crossSize = mappers.fn(
        p.cos( sizeRatio ),
        -1,
        1,
        sizeMin,
        sizeMax
      );

      const fgColor = palette( {
        hueOffset: t,
        hueIndex: mappers.fn(
          lerpIndex,
          0,
          1,
          -p.PI,
          p.PI
        ) * hueIndexMultiplier,
        opacityFactor: mappers.fn(
          p.cos( sizeRatio + t ),
          -1,
          1,
          opacityMax,
          opacityMin
        )
      } );

      cross( {
        position: vector,
        sides,
        borderColor: fgColor,
        borderWidth,
        size: crossSize,
        depth: 1,
        recursive: true
      } );
    }
  );

  renderTitle();
} );
