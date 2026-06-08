import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import string from "@/p5/utils/string.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import {
  getAlphabet, drawGrid, getFont, loopedTime, drawShape
} from "../_shared.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

sketch.draw( (
  _t, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );
  p.noFill();

  const time = loopedTime();
  const alphabet = getAlphabet( "123456789" );
  const font = getFont( options.sketch.textStyle?.font );

  const W = p.width / 2;
  const H = p.height / 2;
  const letterSize = ( options.sketch.textStyle?.size ?? 0.66 ) * p.width;

  const columns = options.sketch.grid?.columns ?? 3;
  const rows = options.sketch.grid?.rows ?? 3;

  if ( options.sketch.grid?.show ) {
    p.push();
    p.translate(
      -W,
      -H
    );
    drawGrid( {
      xCount: columns,
      yCount: rows,
      color: favoriteColor,
      weight: options.sketch.grid?.weight ?? 0.5
    } );
    p.pop();
  }

  p.translate(
    0,
    0,
    1
  );

  const positions = [];

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

      positions.push( p.createVector(
        x,
        y
      ) );
    }
  }

  const hues = positions.map( (
    _, index
  ) => colors.rainbow( {
    hueOffset: options.sketch.colors?.hueOffset ?? 0,
    opacityFactor: options.sketch.colors?.opacityMin ?? 1.5,
    hueIndex: mappers.fn(
      index,
      0,
      positions.length - 1,
      -p.PI,
      p.PI
    ) * ( options.sketch.colors?.hueIndexMultiplier ?? 1 )
  } ) );

  const hue = animation.ease( {
    values: hues,
    duration: 1,
    lerpFn: p.lerpColor.bind( p ),
    currentTime: time
  } );

  const position = animation.ease( {
    values: positions,
    duration: 1,
    lerpFn: mappers.lerpVector,
    easingFn: easing.easeInOutExpo,
    currentTime: time
  } );

  const sampleFactor = options.sketch.textStyle?.sampleFactor ?? 0.5;

  const points = animation.ease( {
    values: alphabet.map( ( text ) => string.getTextPoints( {
      text,
      size: letterSize,
      position: center,
      sampleFactor,
      font
    } ) ),
    duration: 1,
    lerpFn: mappers.lerpPoints,
    easingFn: easing.easeInOutExpo,
    currentTime: time
  } );

  p.push();
  p.translate(
    position.x,
    position.y
  );
  p.stroke( hue );
  p.strokeWeight( options.sketch.traced?.weight ?? 2 );
  drawShape(
    points,
    false
  );
  p.pop();

  renderTitle();
} );
