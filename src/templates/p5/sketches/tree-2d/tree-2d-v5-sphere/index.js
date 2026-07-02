import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import iterators from "@/p5/utils/iterators.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

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

  const gridColumns = options.sketch.grid?.columns ?? 2;
  const gridRows = options.sketch.grid?.rows ?? 5;
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
  const branchCount = options.sketch.branches?.count ?? 5;
  const branchPhaseDivider = options.sketch.branches?.phaseDivider ?? 120;

  const waveStrengthEasing = easing?.[ options.sketch.waves?.strengthEasing ] ?? easing.easeInOutSine;
  const waveCountEasing = easing?.[ options.sketch.waves?.countEasing ] ?? easing.easeInOutSine;
  const waveCountMax = options.sketch.waves?.countMax ?? 2;
  const waveAmpXDivider = options.sketch.waves?.amplitudeXDivider ?? 3;
  const waveAmpY = options.sketch.waves?.amplitudeY ?? 200;

  const linesCount = options.sketch.lines?.count ?? 4;
  const linesLength = options.sketch.lines?.length ?? 75;
  const linesLengthEasing = easing?.[ options.sketch.lines?.lengthEasing ] ?? easing.easeInOutSine;
  const linesWeightMin = options.sketch.lines?.weightMin ?? 10;
  const linesWeightMax = options.sketch.lines?.weightMax ?? 20;
  const linesWeightEasing = easing?.[ options.sketch.lines?.weightEasing ] ?? easing.easeInOutExpo;
  const swappedVertices = options.sketch.lines?.swappedVertices ?? true;

  const rotationSpeed = options.sketch.rotation?.speed ?? 2;
  const rotationCount = options.sketch.rotation?.count ?? 1;
  const rotationStepDivider = options.sketch.rotation?.stepDivider ?? 60;

  const opacityStart = options.sketch.opacity?.startFactor ?? 3;
  const opacityEnd = options.sketch.opacity?.endFactor ?? 1.5;
  const opacitySpeed = options.sketch.opacity?.speed ?? 3;
  const opacityGroupCount = options.sketch.opacity?.groupCount ?? 3;
  const pingPongOpacity = options.sketch.opacity?.pingPong ?? false;

  const palette = resolvePalette( options.sketch.colors?.palette ?? "rainbow" );
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 16;
  const hueIndexEasing = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.easeInOutCubic;
  const hueNoiseTimeMix = options.sketch.colors?.hueNoiseTimeMix ?? 0.5;
  const hueOffsetTimeMix = options.sketch.colors?.hueOffsetTimeMix ?? 0;

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop (the raw,
  // non-wrapping `time.seconds()` this draw loop used to receive never
  // returns to its start), so every oscillator driven by it below is snapped
  // to a WHOLE number of cycles per loop.
  //
  // NOTE: the hue index below is driven by p.noise( ..., time * hueNoiseTimeMix )
  // — p5 noise is not periodic, so that term is left on the raw `time` clock
  // and cannot be made loop-exact by snapping (needs a circular-noise
  // redesign, out of scope here).
  const t = animation.angle;
  const rotationTurns = Math.round( rotationSpeed );
  const opacityTurns = Math.round( opacitySpeed );
  const hueTurns = Math.round( hueOffsetTimeMix );
  // The wave offset's raw rate was an implicit 1/2 (no user-facing speed
  // control) — rounds to 1 whole cycle per loop.
  const halfCycles = Math.round( 1 / 2 );

  for ( let b = 0; b < branchCount; b++ ) {
    const branchProgression = b / steps;

    for ( let i = 0; i < steps; i++ ) {
      const stepsProgression = i / steps;
      const circularStepsProgression = mappers.circular(
        stepsProgression,
        0,
        1,
        0,
        1
      );

      const position = mappers.lerpVector(
        start,
        end,
        stepsProgression
      );

      const wavesStrength = mappers.fn(
        circularStepsProgression,
        0,
        1,
        0,
        1,
        waveStrengthEasing
      );
      const wavesCount = mappers.fn(
        circularStepsProgression,
        1,
        0,
        0,
        waveCountMax,
        waveCountEasing
      );

      const wavesOffset = p.map(
        b,
        0,
        branchCount,
        -p.PI,
        p.PI
      ) - time / 2 + wavesCount + i / branchPhaseDivider;

      const ampX = p.width / waveAmpXDivider;
      const ampY = waveAmpY;

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

      const lineMin = 0;
      const lineMax = p.PI;
      const lineStep = lineMax / linesCount;

      for ( let lineIndex = lineMin; lineIndex < lineMax; lineIndex += lineStep ) {
        const vector = converters.polar.vector(
          lineIndex,
          mappers.fn(
            circularStepsProgression,
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
          circularStepsProgression,
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
          hueOffset: time * hueOffsetTimeMix,
          hueIndex: mappers.fn(
            p.noise(
              branchProgression,
              stepsProgression + time * hueNoiseTimeMix
            ),
            0,
            1,
            -p.PI / 2,
            p.PI / 2,
            hueIndexEasing
          ) * hueIndexMultiplier,
          opacityFactor
        } ) );

        if ( swappedVertices ) {
          p.vertex(
            -vector.y,
            vector.x
          );
          p.vertex(
            vector.x,
            -vector.y
          );
        } else {
          p.vertex(
            vector.x,
            vector.y
          );
          p.vertex(
            -vector.x,
            -vector.y
          );
        }

        p.endShape();
        p.pop();
      }
    }
  }

  renderTitle();
} );
