import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    0,
    0,
    0
  ];

sketch.draw( () => {
  const p = getP5();

  p.background( ...getBackgroundColor() );
  p.noFill();

  const fontName = options.sketch?.shape?.font ?? "sans";
  const font = string.fonts?.[ fontName ];
  const text = options.sketch?.shape?.text ?? "0";
  const sizeFactor = options.sketch?.shape?.sizeFactor ?? 1;
  const size = ( ( p.width + p.height ) / 8 ) * sizeFactor;
  const sampleFactor = options.sketch?.shape?.sampleFactor ?? 0.25;
  const simplifyThreshold = options.sketch?.shape?.simplifyThreshold ?? 0;

  const letterPoints = string.getTextPoints( {
    text,
    position: p.createVector(
      0,
      0
    ),
    size,
    font,
    sampleFactor,
    simplifyThreshold
  } );

  if ( !letterPoints || letterPoints.length === 0 ) {
    return;
  }

  const rotateYSpeed = options.sketch?.animation?.rotateYSpeed ?? 4;
  const rotateXSpeed = options.sketch?.animation?.rotateXSpeed ?? 2;
  const rotateZEnabled = options.sketch?.animation?.rotateZEnabled ?? true;
  const rotateZSpeed = options.sketch?.animation?.rotateZSpeed ?? 1;
  const rotateYEasingFn =
    easing?.[ options.sketch?.animation?.rotateYEasing ] ?? easing.easeInOutCubic;
  const rotateXEasingFn =
    easing?.[ options.sketch?.animation?.rotateXEasing ] ?? easing.easeInOutCubic;

  p.rotateY( animation.ease( {
    values: [
      p.PI / 2,
      p.PI / 2,
      0,
      0
    ],
    currentTime: animation.progression * rotateYSpeed,
    duration: 1,
    easingFn: rotateYEasingFn
  } ) );
  p.rotateX( animation.ease( {
    values: [
      0,
      p.PI / 2
    ],
    currentTime: animation.progression * rotateXSpeed,
    duration: 1,
    easingFn: rotateXEasingFn
  } ) );

  if ( rotateZEnabled ) {
    p.rotateZ( animation.angle * rotateZSpeed );
  }

  const radiusFactor = options.sketch?.cylinder?.radiusFactor ?? 1;
  const H = ( p.height / 4 ) * radiusFactor;

  const count = options.sketch?.cylinder?.count ?? 50;
  const angleStep = p.TAU / count;

  p.strokeWeight( options.sketch?.cylinder?.strokeWeight ?? 6 );

  const hueMultiplier = options.sketch?.color?.hueMultiplier ?? 4;
  const hueOffsetSpeed = options.sketch?.color?.hueOffsetSpeed ?? 1;
  const opacityMin = options.sketch?.color?.opacityMin ?? 1;
  const darkness = options.sketch?.color?.darkness ?? 25;
  const opacityThreshold = options.sketch?.color?.opacityThreshold ?? 10;

  const waveXDivisor = options.sketch?.wave?.xDivisor ?? 4;
  const waveYDivisor = options.sketch?.wave?.yDivisor ?? 40;
  const waveSpeedMultiplier = options.sketch?.wave?.speedMultiplier ?? 8;
  const waveProgressionMultiplier = options.sketch?.wave?.progressionMultiplier ?? 6;

  for ( let angle = 0; angle < p.TAU; angle += angleStep ) {
    const progression = angle / p.TAU;
    const px = Math.sin( angle ) * H;
    const py = Math.cos( angle ) * H;

    p.push();
    p.translate(
      px,
      py
    );
    p.rotateY( p.PI / 2 );
    p.rotateX( angle );

    const xSign = Math.sin( animation.angle );
    const ySign = Math.cos( -animation.angle );
    const hueOpacitySpeed = -animation.angle * waveSpeedMultiplier;

    letterPoints.forEach( ( {
      x, y
    } ) => {
      const wave =
        xSign * ( x / ( p.width / waveXDivisor ) ) +
        ySign * ( y / ( p.height / waveYDivisor ) ) +
        hueOpacitySpeed +
        progression * waveProgressionMultiplier;
      const sineWave = Math.sin( wave );
      const opacityFactor = p.map(
        sineWave,
        -1,
        1,
        darkness,
        opacityMin
      );

      if ( opacityFactor < opacityThreshold ) {
        const tint = colors.rainbow( {
          hueOffset: animation.angle * hueOffsetSpeed,
          hueIndex: p.map(
            progression,
            0,
            1,
            -p.PI,
            p.PI
          ) * hueMultiplier
        } );

        p.stroke( tint );
        p.point(
          x,
          y
        );
      }
    } );

    p.pop();
  }
} );
