import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";

const PALETTES = {
  rainbow: colors.rainbow,
  rainbowCrazy: colors.rainbowCrazy,
  purple: colors.purple,
  darkBlueYellow: colors.darkBlueYellow,
  black: colors.black,
  green: colors.green
};

const resolvePalette = ( name ) => PALETTES[ name ] ?? colors.rainbow;

const MOTION_X_VALUES = [
  0.25,
  0.1,
  0.4
];
const MOTION_Y_VALUES = [
  -0.1,
  0.2,
  0.3
];
const DISPLACE_Y_VALUES = [
  2,
  1,
  3
];
const COLOR_PRECISION_VALUES = [
  0.25,
  1.5,
  0.5,
  1,
  2
];

sketch.setup( () => {} );

sketch.draw( async() => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle;

  const rows = options.sketch.grid?.rows ?? 25;
  const columns = options.sketch.grid?.columns ?? 150;

  const gridOptions = {
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
  };

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;
  const scale = ( cellWidth + cellHeight ) / 2;
  const zMax = scale * ( options.sketch.displacement?.zScale ?? 10 );

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 3,
    options.sketch.noise?.falloff ?? 0.45
  );

  const noiseXMult = options.sketch.noise?.xMultiplier ?? 1;
  const noiseYMult = options.sketch.noise?.yMultiplier ?? 1;
  const noiseTimeX = options.sketch.noise?.timeXMultiplier ?? 0.2;
  const noiseTimeZ = options.sketch.noise?.timeZMultiplier ?? 0.1;
  const angleCycles = options.sketch.angle?.cycles ?? 4;

  const strokeMin = options.sketch.stroke?.weightMin ?? 40;
  const strokeMax = options.sketch.stroke?.weightMax ?? 50;

  const paletteA = resolvePalette( options.sketch.colors?.paletteA ?? "rainbow" );
  const paletteB = resolvePalette( options.sketch.colors?.paletteB ?? "purple" );
  const paletteSwitchSpeed = options.sketch.colors?.paletteSwitchSpeed ?? 0;

  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityMax = options.sketch.colors?.opacityMax ?? 3;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const opacityEasingFn = easing?.[ options.sketch.colors?.opacityEasing ] ?? easing.linear;
  const hueIndexEasingFn = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.linear;

  const motionEnabled = options.sketch.motion?.enabled ?? true;
  const motionSpeedX = options.sketch.motion?.speedX ?? 0.5;
  const motionSpeedY = options.sketch.motion?.speedY ?? 0.33;
  const displaceYSpeed = options.sketch.displacement?.yPatternSpeed ?? 0.5;
  const colorPrecisionSpeed = options.sketch.colors?.precisionSpeed ?? 1;

  const generalXOff = motionEnabled
    ? animation.sequence(
      "noise-strips-v2-x",
      t * motionSpeedX,
      MOTION_X_VALUES
    )
    : 0;
  const generalYOff = motionEnabled
    ? animation.sequence(
      "noise-strips-v2-y",
      t * motionSpeedY,
      MOTION_Y_VALUES
    )
    : 0;

  const siiin = animation.sequence(
    "noise-strips-v2-yScale",
    t * displaceYSpeed,
    DISPLACE_Y_VALUES
  );

  await grid.draw(
    gridOptions,
    (
      position, {
        x, y
      }
    ) => {
      const xOff = x / columns;
      const yOff = y / rows;

      const angle = p.noise(
        xOff * noiseXMult + generalXOff - t * noiseTimeX,
        yOff * noiseYMult + generalYOff,
        t * noiseTimeZ
      ) * ( p.TAU * angleCycles );

      const z = zMax * p.cos( angle );
      const weight = mappers.fn(
        z,
        -zMax,
        zMax,
        strokeMin,
        strokeMax
      );

      const colorPrecision = mappers.circularIndex(
        ( t + yOff ) * colorPrecisionSpeed,
        COLOR_PRECISION_VALUES
      );

      const colorFunction = mappers.circularIndex(
        ( xOff + yOff + t ) * paletteSwitchSpeed,
        [
          paletteA,
          paletteB
        ]
      );

      p.stroke( colorFunction( {
        hueOffset,
        hueIndex: mappers.fn(
          z,
          -zMax,
          zMax,
          -p.PI,
          p.PI,
          hueIndexEasingFn
        ) * colorPrecision,
        opacityFactor: mappers.fn(
          z,
          -zMax,
          zMax,
          opacityMax,
          opacityMin,
          opacityEasingFn
        )
      } ) );

      p.push();
      p.translate(
        position.x + cellWidth / 2,
        position.y + cellHeight / 2
      );
      p.strokeWeight( weight );
      p.translate(
        scale * p.sin( angle ),
        scale * p.cos( angle ) * siiin
      );
      p.point(
        0,
        0
      );
      p.pop();
    }
  );
} );
