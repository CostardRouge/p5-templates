import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import cache from "@/p5/utils/cache.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import converters from "@/p5/utils/converters.js";
import iterators from "@/p5/utils/iterators.js";
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

function drawWalkingGrid(
  xCount, yCount, color, weight, scrollSpeed
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

  if ( xCount > 0 ) {
    const lines = cache.store(
      "tree-2d-v6-walking__x-lines",
      () => {
        const result = [];

        for ( let x = -1; x < xCount; x++ ) {
          result.push( xSize + x * xSize );
        }

        return result;
      }
    );

    lines.forEach( (
      _, index
    ) => {
      if ( lines[ index ] <= 0 ) {
        lines[ index ] = p.width;
      }

      lines[ index ] -= scrollSpeed;
    } );

    lines.forEach( ( xPosition ) => {
      p.strokeWeight( weight );
      p.line(
        xPosition,
        0,
        xPosition,
        p.height
      );
    } );
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

  const gridColumns = options.sketch.grid?.columns ?? 5;
  const gridRows = options.sketch.grid?.rows ?? 0;
  const gridWeight = options.sketch.grid?.weight ?? 2;
  const gridShow = options.sketch.grid?.show ?? true;
  const gridScrollSpeed = options.sketch.grid?.scrollSpeed ?? 1.5;
  const gridPalette = resolvePalette( options.sketch.grid?.palette ?? "purple" );

  if ( gridShow ) {
    drawWalkingGrid(
      gridColumns,
      gridRows,
      gridPalette( {
        hueOffset: 0,
        hueIndex: 0,
        opacityFactor: 1
      } ),
      gridWeight,
      gridScrollSpeed
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
  const branchCount = options.sketch.branches?.count ?? 3;

  const waveStrengthEasing = easing?.[ options.sketch.waves?.strengthEasing ] ?? easing.easeInOutQuad;
  const waveAmpXDivider = options.sketch.waves?.amplitudeXDivider ?? 4;
  const waveAmpYDivider = options.sketch.waves?.amplitudeYDivider ?? 8;
  const waveXEasing = easing?.[ options.sketch.waves?.xEasing ] ?? easing.easeInQuad;
  const waveYEasing = easing?.[ options.sketch.waves?.yEasing ] ?? easing.easeOutQuad;

  const linesCountMin = options.sketch.lines?.countMin ?? 1;
  const linesCountMax = options.sketch.lines?.countMax ?? 4;
  const linesLength = options.sketch.lines?.length ?? 60;
  const linesWeight = options.sketch.lines?.weight ?? 20;
  const linesCountEasing = easing?.[ options.sketch.lines?.countEasing ] ?? easing.easeInOutQuad;

  const opacityStart = options.sketch.opacity?.startFactor ?? 3;
  const opacityEnd = options.sketch.opacity?.endFactor ?? 1.3;
  const opacitySpeed = options.sketch.opacity?.speed ?? 3;
  const opacityGroupCount = options.sketch.opacity?.groupCount ?? 3;
  const pingPongOpacity = options.sketch.opacity?.pingPong ?? false;

  const palette = resolvePalette( options.sketch.colors?.palette ?? "rainbow" );
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 16;
  const hueIndexEasing = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.easeInOutSine;
  const hueOffsetTimeMix = options.sketch.colors?.hueOffsetTimeMix ?? 0;

  for ( let i = 0; i < steps; i++ ) {
    const stepsProgression = i / steps;
    const circularStepsProgression = mappers.circular(
      stepsProgression,
      0,
      1,
      0,
      1
    );

    for ( let b = 0; b < branchCount; b++ ) {
      const branchProgression = b / steps;

      const position = mappers.lerpVector(
        start,
        end,
        stepsProgression
      );

      const wavesStrength = mappers.fn(
        stepsProgression,
        0,
        1,
        0,
        1,
        waveStrengthEasing
      );

      const wavesOffset = p.map(
        b,
        0,
        branchCount,
        -p.PI,
        p.PI
      );

      const ampX = p.width / waveAmpXDivider;
      const ampY = p.width / waveAmpYDivider;

      position.add(
        mappers.fn(
          p.sin( wavesOffset - time ),
          -1,
          1,
          -ampX,
          ampX,
          waveXEasing
        ) * wavesStrength,
        mappers.fn(
          p.cos( wavesOffset - time ),
          -1,
          1,
          -ampY,
          0,
          waveYEasing
        ) * wavesStrength,
        0
      );

      const linesCount = mappers.fn(
        circularStepsProgression,
        0,
        1,
        linesCountMin,
        linesCountMax,
        linesCountEasing
      );
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
            p.sin( stepsProgression ),
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

  renderTitle();
} );
