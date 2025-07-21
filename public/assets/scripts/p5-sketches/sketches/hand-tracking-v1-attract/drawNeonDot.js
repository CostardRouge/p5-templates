import {
  colors,
  mappers,
  animation,
} from "/assets/scripts/p5-sketches/utils/index.js";

export function createNeonDots( count ) {
  for ( let i = 0; i < count; i++ ) {
    const [
      minSize,
      maxSize
    ] = [
      random(
        70,
        100
      ),
      random(
        10,
        20
      )
    ];

    neonDots.push( {
      sizeRange: [
        minSize,
        maxSize
      ],
      position: createVector(
        random(
          maxSize * 2,
          width - maxSize * 2
        ),
        random(
          maxSize * 2,
          height - maxSize * 2
        )
      ),
      index: i / count
    } );
  }
}

export function drawNeonDots( ) {
  neonDots.forEach( (
    neonDotData, index
  ) => {
    neonDot( {
      ...neonDotData,
      graphics: layers.dots.graphics,
      index: index / neonDots.length,
    } );
  } );
}

export const neonDots = [
];

export default function drawNeonDot( {
  sizeRange = [
    300,
    75
  ],
  shadowsCount = 3,
  graphics = window,
  position,
  index
} = {
} ) {
  for ( let shadowIndex = 0; shadowIndex < shadowsCount; shadowIndex++ ) {
    const shadowProgression = shadowsCount / shadowsCount;

    const circleSize = mappers.fn(
      shadowIndex,
      0,
      shadowsCount,
      sizeRange[ 0 ],
      sizeRange[ 1 ],
      // easing.easeInExpo
    );

    graphics.stroke( colors.rainbow( {
      opacityFactor: map(
        shadowIndex,
        0,
        shadowsCount,
        2,
        0.75
      ),
      hueOffset: ( animation.circularProgression + shadowProgression ),
      hueIndex: map(
        index,
        0,
        1,
        -PI,
        PI
      ),
    } ) );

    graphics.strokeWeight( circleSize );

    graphics.point(
      position.x,
      position.y
    );
  }
}