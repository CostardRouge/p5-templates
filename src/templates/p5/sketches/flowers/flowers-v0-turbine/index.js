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

  const t = animation.angle * ( options.sketch.timeScale ?? 1 );

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
        const sides = mappers.circularIndex(
          t + p.noise(
            yOff + t,
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
            hueOffset: t + p.sin( y + t ),
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
  const rotationSpeed = options.sketch.foreground?.rotationSpeed ?? 0.2;

  iterators.vector(
    start,
    end,
    pathStep,
    (
      vector, lerpIndex
    ) => {
      const easingFunction = mappers.circularIndex(
        lerpIndex + t,
        easingFunctions
      )[ 1 ];

      const colorFunction = mappers.circularIndex(
        t + lerpIndex,
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
      const amt = animation.sequence(
        "flowers-v0-amt",
        t + lerpIndex,
        sidesValues
      );

      const fgColor = colorFunction( {
        hueOffset: t,
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
      p.rotate( t * rotationSpeed + mappers.fn(
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
