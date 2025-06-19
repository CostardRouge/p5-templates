import {
  animation, colors
} from "/assets/scripts/p5-sketches/utils/index.js";

export const chewingGums = [
];

export function createChewingGums( count ) {
  for ( let i = 0; i < count; i++ ) {
    const size = random(
      70,
      100
    );

    chewingGums.push( {
      size,
      position: createVector(
        random(
          size * 2,
          width - size * 2
        ),
        random(
          size * 2,
          height - size * 2
        )
      ),
      index: i / count
    } );
  }
}

export function drawChewingGums( ) {
  chewingGums.forEach( (
    chewingGumData, index
  ) => {
    chewingGum( {
      ...chewingGumData,
      graphics: layers.dots.graphics,
      index: index / chewingGums.length,
    } );
  } );
}

export default function drawChewingGum( {
  lerpStep = 1 / 250,
  graphics = window,
  position,
  size = 10,
  index
} = {
} ) {
  graphics.push();
  graphics.noStroke();
  graphics.translate(
    position.x,
    position.y
  );

  for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
    const angle = map(
      lerpIndex,
      0,
      1 / 50,
      -PI,
      PI
    );

    const movingSize = map(
      Math.sin( animation.sinAngle * 10 + index ),
      -1,
      1,
      size / 2,
      size
    );

    const waveIndex = angle + lerpIndex;

    graphics.fill( colors.rainbow( {
      opacityFactor: map(
        lerpIndex,
        0,
        1,
        1,
        3
      ),
      // hueOffset: easing.easeOutSine( index ),
      hueIndex: map(
        Math.sin( lerpIndex + angle - animation.circularProgression ),
        -1,
        1,
        -PI,
        PI
      ) * 2,
    } ) );

    const xOff = map(
      Math.sin( animation.sinAngle * 2 ),
      -1,
      1,
      -map(
        Math.sin( waveIndex * -2 ),
        -1,
        1,
        -size,
        size
      ),
      map(
        Math.sin( waveIndex ),
        -1,
        1,
        -size,
        size
      )
    );
    const yOff = map(
      Math.cos( waveIndex ),
      -1,
      1,
      -movingSize,
      movingSize
    );

    const radius = map(
      lerpIndex,
      0,
      1,
      50,
      1,
      true
    );

    graphics.circle(
      xOff,
      yOff,
      radius
    );
  }

  graphics.pop();
}