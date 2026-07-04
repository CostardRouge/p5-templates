import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import iterators from "@/p5/utils/iterators.js";

const PALETTES = {
  rainbow: colors.rainbow,
  rainbowCrazy: colors.rainbowCrazy,
  test: colors.test,
  purple: colors.purple,
  darkBlueYellow: colors.darkBlueYellow,
  green: colors.green,
  black: colors.black
};

const resolvePalette = ( name ) => PALETTES[ name ] ?? colors.rainbow;

sketch.setup( () => {} );

function drawGrid(
  xCount, yCount, color, weight = 2
) {
  const p = getP5();

  if ( xCount <= 0 && yCount <= 0 ) {
    return;
  }

  const xSize = p.width / Math.max(
    xCount,
    1
  );
  const ySize = p.height / Math.max(
    yCount,
    1
  );

  p.stroke( color );
  p.strokeWeight( weight );

  for ( let x = 0; x < xCount - 1; x++ ) {
    iterators.vectors(
      [
        p.createVector(
          xSize + x * xSize,
          0
        ),
        p.createVector(
          xSize + x * xSize,
          p.height
        )
      ],
      ( position ) => {
        p.strokeWeight( 6 );
        p.point(
          position.x,
          position.y
        );
      },
      0.05
    );

    p.strokeWeight( weight );
    p.line(
      xSize + x * xSize,
      0,
      xSize + x * xSize,
      p.height
    );
  }

  for ( let y = 0; y < yCount - 1; y++ ) {
    p.strokeWeight( weight );
    p.line(
      0,
      ySize + y * ySize,
      p.width,
      y * ySize + ySize
    );

    iterators.vectors(
      [
        p.createVector(
          0,
          ySize + y * ySize
        ),
        p.createVector(
          p.width,
          y * ySize + ySize
        )
      ],
      ( position ) => {
        p.strokeWeight( 6 );
        p.point(
          position.x,
          position.y
        );
      },
      0.05
    );
  }
}

sketch.draw( (
  time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const gridColumns = options.sketch.grid?.columns ?? 4;
  const gridRows = options.sketch.grid?.rows ?? 2;
  const gridWeight = options.sketch.grid?.weight ?? 2;
  const gridShow = options.sketch.grid?.show ?? true;
  const gridPalette = resolvePalette( options.sketch.grid?.palette ?? "purple" );

  if ( gridShow ) {
    drawGrid(
      gridColumns,
      gridRows,
      gridPalette( {
        hueOffset: 0,
        hueIndex: 0,
        opacityFactor: 1
      } ),
      gridWeight
    );
  }

  const marginTop = options.sketch.path?.marginTop ?? 100;
  const marginBottom = options.sketch.path?.marginBottom ?? 250;
  const start = p.createVector(
    p.width / 2,
    marginTop
  );
  const end = p.createVector(
    p.width / 2,
    p.height - marginBottom
  );

  const steps = options.sketch.steps ?? 400;
  const branchCount = options.sketch.branches?.count ?? 6;
  const branchTimeSign = options.sketch.branches?.timeSign ?? -1;
  const branchPhaseDivider = options.sketch.branches?.phaseDivider ?? 120;

  const waveStrengthEasing = easing?.[ options.sketch.waves?.strengthEasing ] ?? easing.easeInOutSine;
  const waveCountEasing = easing?.[ options.sketch.waves?.countEasing ] ?? easing.easeInOutQuart;
  const waveCountMax = options.sketch.waves?.countMax ?? 2;
  const waveAmpXDivider = options.sketch.waves?.amplitudeXDivider ?? 3;
  const waveAmpYDivider = options.sketch.waves?.amplitudeYDivider ?? 9;

  const linesCountMin = options.sketch.lines?.countMin ?? 1;
  const linesCountMax = options.sketch.lines?.countMax ?? 3;
  const linesLength = options.sketch.lines?.length ?? 75;
  const linesWeightMin = options.sketch.lines?.weightMin ?? 10;
  const linesWeightMax = options.sketch.lines?.weightMax ?? 30;
  const linesLengthEasing = easing?.[ options.sketch.lines?.lengthEasing ] ?? easing.easeInQuad;
  const linesCountEasing = easing?.[ options.sketch.lines?.countEasing ] ?? easing.easeInOutQuad;
  const linesWeightEasing = easing?.[ options.sketch.lines?.weightEasing ] ?? easing.easeInOutQuad;

  const rotationSpeed = options.sketch.rotation?.speed ?? 2;
  const rotationCount = options.sketch.rotation?.count ?? 1;
  const rotationStepDivider = options.sketch.rotation?.stepDivider ?? 30;

  const opacityStart = options.sketch.opacity?.startFactor ?? 3;
  const opacityEnd = options.sketch.opacity?.endFactor ?? 1;
  const opacitySpeed = options.sketch.opacity?.speed ?? 3;
  const opacityGroupCount = options.sketch.opacity?.groupCount ?? 3;
  const pingPongOpacity = options.sketch.opacity?.pingPong ?? false;

  const palette = resolvePalette( options.sketch.colors?.palette ?? "rainbow" );
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 8;
  const hueIndexEasing = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.easeInOutCubic;
  const hueOffsetTimeMix = options.sketch.colors?.hueOffsetTimeMix ?? 1;
  const hueOffsetBranchMix = options.sketch.colors?.hueOffsetBranchMix ?? 1;

  for ( let i = 0; i < steps; i++ ) {
    const stepsProgression = i / steps;

    for ( let b = 0; b < branchCount; b++ ) {
      const branchProgression = b / steps;

      const position = mappers.lerpVector(
        start,
        end,
        stepsProgression
      );

      const wavesOffset = (
        b
        + time * branchTimeSign
        + stepsProgression
        + i / branchPhaseDivider
      );
      const wavesStrength = mappers.fn(
        stepsProgression,
        0,
        1,
        0,
        1,
        waveStrengthEasing
      );
      const wavesCount = mappers.fn(
        stepsProgression,
        1,
        0,
        0,
        waveCountMax,
        waveCountEasing
      );
      const polarProgression = -p.map(
        stepsProgression,
        1,
        0,
        -p.PI / 2,
        p.PI / 2
      ) * wavesCount;
      const ampX = p.width / waveAmpXDivider;
      const ampY = p.width / waveAmpYDivider;

      position.add(
        p.map(
          p.sin( polarProgression + wavesOffset ),
          -1,
          1,
          ampX,
          -ampX
        ) * wavesStrength,
        -p.map(
          p.cos( polarProgression + wavesOffset + b ),
          -1,
          1,
          ampY,
          -ampY
        ) * wavesStrength,
        0
      );

      const linesCount = mappers.fn(
        stepsProgression,
        0,
        1,
        linesCountMin,
        linesCountMax,
        linesCountEasing
      );
      const lineMin = 0;
      const lineMax = p.PI;
      const lineStep = lineMax / linesCount;

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          mappers.fn(
            stepsProgression,
            0,
            1,
            1,
            linesLength,
            linesLengthEasing
          )
        );

        p.push();
        p.translate(
          position.x,
          position.y
        );

        p.rotate( time * rotationSpeed
          + b
          + ( i / rotationStepDivider ) * rotationCount );

        p.beginShape();
        p.strokeWeight( mappers.fn(
          stepsProgression,
          0,
          1,
          linesWeightMin,
          linesWeightMax,
          linesWeightEasing
        ) );

        let opacityFactor = mappers.circular(
          stepsProgression,
          0,
          1,
          p.map(
            p.sin( opacitySpeed + branchProgression * opacityGroupCount ),
            -1,
            1,
            opacityStart,
            opacityEnd
          ),
          opacityEnd
        );

        if ( pingPongOpacity ) {
          opacityFactor = p.map(
            p.map(
              p.sin( stepsProgression * opacityGroupCount - time * opacitySpeed ),
              -1,
              1,
              -1,
              1
            ),
            -1,
            1,
            p.map(
              p.cos( stepsProgression * opacityGroupCount + time * opacitySpeed ),
              -1,
              1,
              1,
              15
            ),
            1
          );
        }

        p.stroke( palette( {
          hueOffset: time * hueOffsetTimeMix + branchProgression * hueOffsetBranchMix,
          hueIndex: mappers.fn(
            stepsProgression,
            0,
            1,
            -p.PI / 2,
            p.PI / 2,
            hueIndexEasing
          ) * hueIndexMultiplier,
          opacityFactor
        } ) );

        p.vertex(
          vector.x,
          vector.y
        );
        p.vertex(
          -vector.x,
          -vector.y
        );

        p.endShape();
        p.pop();
      }
    }
  }
} );
