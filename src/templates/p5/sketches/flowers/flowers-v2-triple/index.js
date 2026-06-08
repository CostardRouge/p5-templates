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

  const t = animation.angle * ( options.sketch.timeScale ?? 10 );

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

  const start = animation.sequence(
    "flowers-v2-start",
    t * seqSpeed,
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
    t * seqSpeed,
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
  const rotationSpeed = options.sketch.foreground?.rotationSpeed ?? 0.5;
  const hueIndexMultiplier = options.sketch.foreground?.hueIndexMultiplier ?? 4;
  const opacityMax = options.sketch.foreground?.opacityMax ?? 3;
  const opacityMin = options.sketch.foreground?.opacityMin ?? 1.1;
  const opacitySinFactor = options.sketch.foreground?.opacitySinFactor ?? 3;

  iterators.vector(
    start,
    end,
    pathStep,
    (
      vector, lerpIndex
    ) => {
      const sides = animation.sequence(
        "flowers-v2-amt",
        t + lerpIndex,
        sidesSeq
      );
      const times = mappers.circularIndex(
        t + lerpIndex,
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
      p.rotate( -t * rotationSpeed );
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
            p.sin( opacitySinFactor * animation.sinAngle + lerpIndex * 15 + recursionIndex / 50 ),
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
