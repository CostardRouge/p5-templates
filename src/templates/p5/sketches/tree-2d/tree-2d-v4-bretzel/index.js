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

const easingValues = Object.values( easing );

sketch.setup( () => {} );

function easeAcross(
  time, values, functions
) {
  return functions.map( ( fn ) =>
    animation.ease( {
      values,
      duration: 1,
      easingFn: fn,
      currentTime: time
    } ) );
}

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
  _time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const gridColumns = options.sketch.grid?.columns ?? 2;
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

  const waveTimeSpeed = options.sketch.waves?.timeSpeed ?? 1.5;
  const waveAmpXDivider = options.sketch.waves?.amplitudeXDivider ?? 3;
  const waveAmpYDivider = options.sketch.waves?.amplitudeYDivider ?? 6;
  const waveBundleEasing = easing?.[ options.sketch.waves?.bundleEasing ] ?? easing.easeInOutBack;

  const linesCount = options.sketch.lines?.count ?? 3;
  const linesLength = options.sketch.lines?.length ?? 60;
  const linesWeight = options.sketch.lines?.weight ?? 20;

  const rotationSpeed = options.sketch.rotation?.speed ?? 2;
  const rotationCount = options.sketch.rotation?.count ?? 1;
  const rotationStepDivider = options.sketch.rotation?.stepDivider ?? 60;

  const opacityStart = options.sketch.opacity?.startFactor ?? 3;
  const opacityEnd = options.sketch.opacity?.endFactor ?? 1.5;
  const opacitySpeed = options.sketch.opacity?.speed ?? 3;
  const opacityGroupCount = options.sketch.opacity?.groupCount ?? 3;
  const pingPongOpacity = options.sketch.opacity?.pingPong ?? false;

  const palette = resolvePalette( options.sketch.colors?.palette ?? "rainbow" );
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 12;
  const hueTimeSpeed = options.sketch.colors?.hueTimeSpeed ?? 0.5;
  const hueIndexEasing = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.easeInOutSine;
  const hueOffsetTimeMix = options.sketch.colors?.hueOffsetTimeMix ?? 1;

  // Loop-exact clock: animation.angle sweeps exactly TAU per loop (the raw,
  // non-wrapping `time.seconds()` this draw loop used to receive never
  // returns to its start), so every oscillator driven by it below is snapped
  // to a WHOLE number of cycles per loop.
  const t = animation.angle;
  const rotationTurns = Math.round( rotationSpeed );
  const opacityTurns = Math.round( opacitySpeed );
  const hueTurns = Math.round( hueOffsetTimeMix );
  const hueTimeTurns = Math.round( hueTimeSpeed );
  // The wave offset's raw rate was an implicit 1/2 (no user-facing speed
  // control) — rounds to 1 whole cycle per loop.
  const halfCycles = Math.round( 1 / 2 );

  // The wave-bundle ease walks its `easedWaveStrengths.length`-entry array
  // circularly, so it only returns to its start pose after a whole number of
  // full walks — snap the anchor clock to complete exactly that many per
  // loop. The raw currentTime used to advance `waveTimeSpeed` per second, so
  // over one loop (of `duration` seconds) it spanned `waveTimeSpeed *
  // duration` — round that span to a whole multiple of the array length.
  const loopDuration = sketch.sketchOptions.animation.duration;
  const waveValuesLength = easingValues.length;
  const waveCycles = Math.round( ( waveTimeSpeed * loopDuration ) / waveValuesLength );

  for ( let i = 0; i < steps; i++ ) {
    const stepsProgression = i / steps;
    const circularStepsProgression = mappers.circular(
      stepsProgression,
      0,
      1,
      0,
      1
    );
    const easedWaveStrengths = easeAcross(
      circularStepsProgression,
      [
        0,
        1
      ],
      easingValues
    );

    for ( let b = 0; b < branchCount; b++ ) {
      const branchProgression = b / steps;

      const position = mappers.lerpVector(
        start,
        end,
        stepsProgression
      );

      const wavesStrength = animation.ease( {
        values: easedWaveStrengths,
        duration: 1,
        easingFn: waveBundleEasing,
        currentTime: animation.progression * waveCycles * waveValuesLength
      } );

      const wavesOffset = p.map(
        b,
        0,
        branchCount,
        -p.PI,
        p.PI
      ) - t * halfCycles;

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

      const lineMin = 0;
      const lineMax = p.PI;
      const lineStep = lineMax / linesCount;

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

        p.rotate( t * rotationTurns
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
              p.sin( stepsProgression * opacityGroupCount - t * opacityTurns ),
              -1,
              1,
              -1,
              1
            ),
            -1,
            1,
            p.map(
              p.cos( stepsProgression * opacityGroupCount + t * opacityTurns ),
              -1,
              1,
              1,
              15
            ),
            1
          );
        }

        p.stroke( palette( {
          hueOffset: t * hueTurns,
          hueIndex: mappers.fn(
            p.sin( t * hueTimeTurns + circularStepsProgression ),
            -1,
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

  renderTitle();
} );
