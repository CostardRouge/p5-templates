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

const resolvePalette = ( name ) => PALETTES[ name ] ?? colors.test;

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

  const beatMin = options.sketch.beat?.min ?? 3;
  const beatMax = options.sketch.beat?.max ?? 6;
  const beatEasing = easing?.[ options.sketch.beat?.easing ] ?? easing.easeInQuad;
  const beatTimeSign = options.sketch.beat?.timeSign ?? 1;
  const bbb = mappers.fn(
    p.sin( time * beatTimeSign ),
    -1,
    1,
    beatMin,
    beatMax,
    beatEasing
  );

  const gridWeight = options.sketch.grid?.weight ?? 2;
  const gridShow = options.sketch.grid?.show ?? true;
  const gridPalette = resolvePalette( options.sketch.grid?.palette ?? "purple" );

  if ( gridShow ) {
    drawGrid(
      options.sketch.grid?.columns ?? 0,
      Math.max(
        Math.round( bbb ),
        0
      ),
      gridPalette( {
        hueOffset: 0,
        hueIndex: 0,
        opacityFactor: 1
      } ),
      gridWeight
    );
  }

  const marginTop = options.sketch.path?.marginTop ?? 150;
  const marginBottom = options.sketch.path?.marginBottom ?? 150;
  const start = p.createVector(
    p.width / 2,
    marginTop
  );
  const end = p.createVector(
    p.width / 2,
    p.height - marginBottom
  );

  const steps = options.sketch.steps ?? 400;
  const branchBase = options.sketch.branches?.base ?? 3;
  const branchEasing = easing?.[ options.sketch.branches?.easing ] ?? easing.easeInSine;

  const waveAmpXDivider = options.sketch.waves?.amplitudeXDivider ?? 3;
  const waveAmpYDivider = options.sketch.waves?.amplitudeYDivider ?? 6;

  const linesLength = options.sketch.lines?.length ?? 60;
  const linesWeight = options.sketch.lines?.weight ?? 20;
  const linesCountSource = options.sketch.lines?.countSource ?? "beat";
  const linesFixedCount = options.sketch.lines?.fixedCount ?? 4;

  const rotationSpeed = options.sketch.rotation?.speed ?? 2;
  const rotationCount = options.sketch.rotation?.count ?? 1;
  const rotationStepDivider = options.sketch.rotation?.stepDivider ?? 60;

  const opacityStart = options.sketch.opacity?.startFactor ?? 3;
  const opacityEnd = options.sketch.opacity?.endFactor ?? 1.3;
  const opacitySpeed = options.sketch.opacity?.speed ?? 3;
  const opacityGroupCount = options.sketch.opacity?.groupCount ?? 3;
  const pingPongOpacity = options.sketch.opacity?.pingPong ?? false;

  const palette = resolvePalette( options.sketch.colors?.palette ?? "test" );
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 1;
  const hueIndexEasing = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.easeInOutSine;
  const hueOffsetTimeMix = options.sketch.colors?.hueOffsetTimeMix ?? 1;

  for ( let i = 0; i < steps; i++ ) {
    const stepsProgression = i / steps;
    const polarStepsProgression = p.map(
      stepsProgression,
      1,
      0,
      -p.PI / 2,
      p.PI / 2
    );
    const circularStepsProgression = mappers.circular(
      stepsProgression,
      0,
      1,
      0,
      1
    );

    const branchCount = mappers.fn(
      p.cos( time + polarStepsProgression / 2 ),
      -1,
      1,
      branchBase,
      bbb,
      branchEasing
    );

    for ( let b = 0; b < branchCount; b++ ) {
      const branchProgression = b / steps;

      const position = mappers.lerpVector(
        start,
        end,
        stepsProgression
      );

      const wavesStrength = p.map(
        p.sin( time + polarStepsProgression ),
        -1,
        1,
        0,
        1
      );
      const wavesOffset = p.map(
        b,
        0,
        branchCount,
        -p.PI,
        p.PI
      ) - time / 2;

      const ampX = p.width / waveAmpXDivider;
      const ampY = p.width / waveAmpYDivider;

      position.add(
        p.map(
          p.sin( wavesOffset ),
          -1,
          1,
          ampX,
          -ampX
        ) * wavesStrength,
        p.map(
          p.cos( wavesOffset ),
          -1,
          1,
          ampY,
          -ampY
        ) * wavesStrength,
        0
      );

      const linesCount = linesCountSource === "fixed" ? linesFixedCount : bbb;
      const lineMin = 0;
      const lineMax = p.PI;
      const lineStep = lineMax / Math.max(
        linesCount,
        0.01
      );

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          linesLength
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
        p.strokeWeight( linesWeight );

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
          hueOffset: time * hueOffsetTimeMix,
          hueIndex: mappers.fn(
            p.sin( circularStepsProgression ),
            -1,
            1,
            -p.PI,
            p.PI,
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
