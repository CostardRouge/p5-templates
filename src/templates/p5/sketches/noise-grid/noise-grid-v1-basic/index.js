import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";
import colors from "@/p5/utils/colors.js";
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

  const rows = options.sketch.grid?.rows ?? 80;
  const columns = options.sketch.grid?.columns ?? 30;

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
    options.sketch.noise?.detail ?? 3,
    options.sketch.noise?.falloff ?? 0.45
  );

  const scale = ( ( p.width / columns ) + ( p.height / rows ) ) / 2;
  const zMax = scale * ( options.sketch.displacement?.zScale ?? 10 );

  const noiseXMult = options.sketch.noise?.xMultiplier ?? 1;
  const noiseYMult = options.sketch.noise?.yMultiplier ?? 1;
  const noiseTimeX = options.sketch.noise?.timeXMultiplier ?? -1;
  const noiseTimeY = options.sketch.noise?.timeYMultiplier ?? 0.2;
  const noiseTimeZ = options.sketch.noise?.timeZMultiplier ?? 0.07;
  const angleCycles = options.sketch.angle?.cycles ?? 4;

  const strokeMin = options.sketch.stroke?.weightMin ?? 25;
  const strokeMax = options.sketch.stroke?.weightMax ?? 50;

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  const paletteA = resolvePalette( options.sketch.colors?.paletteA ?? "rainbow" );
  const paletteB = resolvePalette( options.sketch.colors?.paletteB ?? "purple" );
  const paletteValues = options.sketch.colors?.precisionValues ?? [
    0.1,
    0.5,
    1,
    2
  ];
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const opacityMax = options.sketch.colors?.opacityMax ?? 3;

  const colorFunction = mappers.circularIndex(
    options.sketch.colors?.paletteIndex ?? 0,
    [
      paletteA,
      paletteB
    ]
  );

  const colorPrecision = animation.sequence(
    "noise-grid-v1-precision",
    t / 2,
    paletteValues
  );

  const translateScale = options.sketch.translation?.scale ?? 1;
  const yTranslateMultiplier = options.sketch.translation?.yMultiplier ?? 2;

  await grid.draw(
    gridOptions,
    (
      position, {
        x, y
      }
    ) => {
      const angle = p.noise(
        ( x / columns ) * noiseXMult + t * noiseTimeX,
        ( y / rows ) * noiseYMult + t * noiseTimeY,
        t * noiseTimeZ
      ) * ( p.TAU * angleCycles );

      const z = zMax * p.cos( angle );

      const weight = p.map(
        z,
        -zMax,
        zMax,
        strokeMin,
        strokeMax
      );

      p.stroke( colorFunction( {
        hueOffset,
        hueIndex: p.map(
          z,
          -zMax,
          zMax,
          -p.PI,
          p.PI
        ) * colorPrecision,
        opacityFactor: p.map(
          z,
          -zMax,
          zMax,
          opacityMax,
          opacityMin
        )
      } ) );

      p.push();
      p.translate(
        position.x + cellWidth / 2,
        position.y + cellHeight / 2
      );
      p.strokeWeight( scale * translateScale );
      p.translate(
        scale * p.sin( angle ),
        scale * p.cos( angle ) * yTranslateMultiplier
      );
      p.point(
        0,
        0
      );
      p.pop();
    }
  );

  renderTitle();
} );
