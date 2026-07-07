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
  -0.4,
  -0.25
];
const MOTION_Z_VALUES = [
  0.25,
  0.1,
  0.4
];
const COLOR_PRECISION_VALUES = [
  0.25,
  0.5,
  0.7
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
  const noiseTimeX = options.sketch.noise?.timeXMultiplier ?? 0.1;
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
  const motionSpeedZ = options.sketch.motion?.speedZ ?? 0.5;
  const displaceYScale = options.sketch.displacement?.yScale ?? 2;
  const colorNoiseScale = options.sketch.colors?.noiseScale ?? 1;

  const generalXOff = motionEnabled
    ? animation.sequence(
      "noise-strips-v3-x",
      t * motionSpeedX,
      MOTION_X_VALUES
    )
    : 0;
  const generalZOff = motionEnabled
    ? animation.sequence(
      "noise-strips-v3-z",
      t * motionSpeedZ,
      MOTION_Z_VALUES
    )
    : 0;

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
        xOff * noiseXMult + generalXOff + t * noiseTimeX,
        yOff * noiseYMult,
        generalZOff
      ) * ( p.TAU * angleCycles );

      const z = zMax * p.cos( angle );
      const weight = mappers.fn(
        z,
        -zMax,
        zMax,
        strokeMin,
        strokeMax
      );

      // Precision picked by spatial noise — creates lava-like color marbling.
      const colorPrecision = mappers.circularIndex(
        ( p.noise(
          xOff * colorNoiseScale,
          yOff * colorNoiseScale
        ) + t ),
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
        scale * p.cos( angle ) * displaceYScale
      );
      p.point(
        0,
        0
      );
      p.pop();
    }
  );
} );
