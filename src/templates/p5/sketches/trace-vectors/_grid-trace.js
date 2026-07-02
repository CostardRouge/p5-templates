import {
  getP5
} from "@/p5/utils/sketch.js";
import cache from "@/p5/utils/cache.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";
import iterators from "@/p5/utils/iterators.js";
import traceLetters from "@/p5/utils/traceLetters.js";

import {
  drawGrid, drawShape, loopedPhase
} from "./_shared.js";

export function buildCases( {
  columns, rows, alphabet
} ) {
  const p = getP5();
  const W = p.width / 2;
  const H = p.height / 2;
  const key = `cases-${ columns }x${ rows }-${ p.width }x${ p.height }-${ alphabet.join( "" ) }`;

  return cache.store(
    key,
    () => {
      const result = [];
      let i = 0;

      for ( let yy = 0; yy < rows; yy++ ) {
        const y = p.lerp(
          -H / ( rows / 2 ),
          H / ( rows / 2 ),
          yy / Math.max(
            1,
            rows - 1
          )
        );

        for ( let xx = 0; xx < columns; xx++ ) {
          const x = p.lerp(
            -W / ( columns / 2 ),
            W / ( columns / 2 ),
            xx / Math.max(
              1,
              columns - 1
            )
          );

          const letterIndex = i++;

          result.push( {
            letter: alphabet[ letterIndex % alphabet.length ],
            letterIndex,
            position: p.createVector(
              x,
              y
            )
          } );
        }
      }

      return result;
    }
  );
}

export function buildPath( {
  cases, randomTrajectory, alphabet
} ) {
  const orderKey = `order-${ cases.length }-${ randomTrajectory }-${ alphabet.join( "" ) }`;
  const positionsKey = `positions-${ cases.length }-${ randomTrajectory }-${ alphabet.join( "" ) }`;

  const order = cache.store(
    orderKey,
    () => cases.map( ( {
      letterIndex
    } ) => letterIndex ).sort( () => 0.5 - Math.random() )
  );

  const positions = cache.store(
    positionsKey,
    () => ( randomTrajectory
      ? order.map( ( letterIndex ) => cases[ letterIndex ].position )
      : order.map( (
        _, index
      ) => cases[ index ].position ) )
  );

  return {
    order,
    positions
  };
}

export function renderGridTraceCommon( {
  opts,
  favoriteColor,
  center,
  font,
  text,
  alphabet,
  time,
  positionTimeOffset = 0,
  positionEasing = easing.easeInOutSine,
  positionTime,
  colorAccent,
  accentMix,
  letterFont,
  chunkColor,
  textEasingFn = easing.easeInOutExpo
} ) {
  const p = getP5();
  const W = p.width / 2;
  const H = p.height / 2;
  const columns = opts.grid?.columns ?? 3;
  const rows = opts.grid?.rows ?? 3;

  if ( opts.grid?.show ) {
    p.push();
    p.translate(
      -W,
      -H
    );
    drawGrid( {
      xCount: columns,
      yCount: rows,
      color: favoriteColor,
      weight: opts.grid?.weight ?? 0.5
    } );
    p.pop();
  }

  const cases = buildCases( {
    columns,
    rows,
    alphabet
  } );

  if ( opts.grid?.showCellLabels ) {
    p.push();
    cases.forEach( ( {
      position, letter
    } ) => {
      if ( !letter ) {
        return;
      }
      string.write(
        letter,
        position.x,
        position.y,
        {
          center: true,
          size: opts.grid?.cellLabelSize ?? 22,
          stroke: 255,
          fill: colorAccent ?? favoriteColor,
          font
        }
      );
    } );
    p.pop();
  }

  const {
    order, positions
  } = buildPath( {
    cases,
    randomTrajectory: opts.trajectory?.random ?? false,
    alphabet
  } );

  if ( opts.trajectory?.linesWeight ) {
    p.stroke( opts.trajectory?.dotColor ?? 96 );
    p.strokeWeight( opts.trajectory.linesWeight );
    drawShape(
      positions,
      true
    );
  }

  if ( opts.trajectory?.pointsWeight ) {
    p.stroke( opts.trajectory?.dotColor ?? 96 );
    p.strokeWeight( opts.trajectory.pointsWeight );

    p.beginShape();
    iterators.vectors(
      positions,
      ( {
        x, y
      } ) => p.point(
        x,
        y
      ),
      opts.trajectory?.pointsInterval ?? 0.05
    );
    iterators.vectors(
      [
        positions[ 0 ],
        positions[ positions.length - 1 ]
      ].filter( Boolean ),
      ( {
        x, y
      } ) => p.point(
        x,
        y
      ),
      opts.trajectory?.pointsInterval ?? 0.05
    );
    p.endShape();
  }

  p.translate(
    0,
    0,
    1
  );

  const start = [];
  const end = [];
  const steps = opts.traced?.steps ?? 33;
  const sampleFactor = opts.textStyle?.sampleFactor ?? 0.1;
  const letterSize = ( opts.textStyle?.size ?? 0.66 ) * p.width;

  const textFont = letterFont ?? font;

  // The glyph clouds do not depend on the per-step `progression`, so build them
  // ONCE per frame (and memoise across frames) instead of rebuilding inside the
  // generator `steps` times. Pixel-identical — see traceLetters.test.ts.
  const morphTexts = opts.trajectory?.random
    ? order.map( ( letterIndex ) => text[ letterIndex % text.length ] )
    : text;

  const letterValues = traceLetters.points( {
    texts: morphTexts,
    size: letterSize,
    position: center,
    sampleFactor,
    font: textFont
  } );

  // Loop-safe letter sweep: drive the morph by animation.progression so the
  // WHOLE text is traversed `lettersSpeed` times per loop and returns exactly to
  // its start at the seam (advancing by an integer multiple of the list length).
  // The old `progression + time` only advanced by loop.timeScale (≈1) per loop,
  // so a 10-letter word showed only its first ~2 glyphs.
  const lettersSpeed = opts.letters?.speed ?? 1;

  mappers.traceVectors(
    steps,
    ( progression ) => traceLetters.morph( {
      values: letterValues,
      duration: 1,
      easingFn: textEasingFn,
      currentTime: progression + traceLetters.sweep(
        animation.progression,
        morphTexts.length,
        lettersSpeed
      )
    } ),
    () => p.beginShape(),
    (
      vector, vectorsListProgression
    ) => {
      const position = animation.ease( {
        values: positions,
        duration: 1,
        lerpFn: mappers.lerpVector,
        easingFn: positionEasing,
        currentTime: ( positionTime ?? time ) + positionTimeOffset + vectorsListProgression
      } );

      position.add( vector );

      if ( vectorsListProgression === 1 ) {
        end.push( position );
      }
      if ( vectorsListProgression === 0 ) {
        start.push( position );
      }

      p.vertex(
        position.x,
        position.y,
        position.z
      );
    },
    (
      vectorIndexProgression, chunkIndex = 1
    ) => {
      const baseColor = chunkColor
        ? chunkColor( {
          p,
          time,
          opts,
          chunkIndex,
          vectorIndexProgression
        } )
        : colors.rainbow( {
          hueOffset: time + ( opts.colors?.hueOffset ?? 0 ),
          hueIndex:
            mappers.fn(
              p.noise(
                chunkIndex,
                vectorIndexProgression * 2
              ),
              0,
              1,
              -p.PI / 2,
              p.PI / 2
            ) * ( opts.colors?.hueIndexMultiplier ?? 8 ),
          opacityFactor: mappers.fn(
            p.noise(
              chunkIndex,
              vectorIndexProgression
            ),
            0,
            1,
            opts.colors?.opacityMax ?? 2.5,
            opts.colors?.opacityMin ?? 1.5
          )
        } );

      const mix = accentMix ?? opts.colors?.accentMix ?? 0;

      p.stroke( colorAccent
        ? p.lerpColor(
          baseColor,
          colorAccent,
          mix
        )
        : baseColor );

      p.strokeWeight( opts.traced?.weight ?? 4 );
      p.noFill();
      p.endShape();
    },
    opts.traced?.smooth ?? true,
    opts.traced?.useChunks ?? false,
    opts.traced?.chunksCount ?? 1
  );

  if ( opts.extremes?.weight ) {
    p.translate(
      0,
      0,
      1
    );
    p.stroke( colorAccent ?? favoriteColor );
    p.fill(
      128,
      128,
      255,
      32
    );
    p.strokeWeight( opts.extremes.weight );

    drawShape(
      end,
      false,
      p.POINTS
    );
    drawShape(
      start,
      false,
      p.POINTS
    );
  }
}
