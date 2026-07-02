import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

const PALETTES = {
  rainbow: colors.rainbow,
  rainbowCrazy: colors.rainbowCrazy,
  purple: colors.purple,
  darkBlueYellow: colors.darkBlueYellow,
  black: colors.black,
  green: colors.green
};

const resolvePalette = ( name ) => PALETTES[ name ] ?? colors.rainbow;

sketch.setup( () => {} );

sketch.draw( async() => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle;

  const rows = options.sketch.grid?.rows ?? 260;
  const columns = options.sketch.grid?.columns ?? 16;

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

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.5
  );

  const noiseXMult = options.sketch.noise?.xMultiplier ?? 1;
  const noiseYMult = options.sketch.noise?.yMultiplier ?? 1;
  const noiseTimeY = options.sketch.noise?.timeYMultiplier ?? 0.4;
  const noiseTimeZ = options.sketch.noise?.timeZMultiplier ?? 0.32;
  const angleCycles = options.sketch.angle?.cycles ?? 4;

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;
  const scale = cellWidth;
  const zMax = scale * ( options.sketch.displacement?.zScale ?? 15 );

  const strokeMin = options.sketch.stroke?.weightMin ?? 25;
  const strokeMax = options.sketch.stroke?.weightMax ?? 50;

  const paletteA = resolvePalette( options.sketch.colors?.paletteA ?? "rainbow" );
  const paletteB = resolvePalette( options.sketch.colors?.paletteB ?? "purple" );

  // The palette swap walks a 2-entry circular index on ( … + t ) * speed, so
  // it only returns to its start palette when the loop's TAU sweep of t
  // advances the index a WHOLE number of 2-entry cycles — snapped to whole
  // cycles per loop.
  const rawPaletteSwitchSpeed = options.sketch.colors?.paletteSwitchSpeed ?? 1;
  const paletteSwitchCycles = Math.round( rawPaletteSwitchSpeed * p.TAU / 2 );
  const paletteSwitchSpeed = paletteSwitchCycles * 2 / p.TAU;

  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 2;
  const opacityMax = options.sketch.colors?.opacityMax ?? 3;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const opacityEasingFn = easing?.[ options.sketch.colors?.opacityEasing ] ?? easing.linear;
  const hueIndexEasingFn = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.linear;

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
        xOff * noiseXMult,
        yOff * noiseYMult + t * noiseTimeY,
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
        ) * hueIndexMultiplier,
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
      p.translate(
        scale * p.sin( angle ),
        scale * p.cos( angle )
      );
      p.strokeWeight( weight );
      p.point(
        0,
        0
      );
      p.pop();
    }
  );

  renderTitle();
} );
