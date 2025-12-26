import options from "@/p5/utils/options.js";
import animation from "@/p5/utils/animation.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import easing from "@/p5/utils/mappers.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

const sketchState = {
  zOff: 0,
};

sketch.setup( ( {
  canvas
} ) => {
  background( ...getBackgroundColor() );
} );

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    246,
    235,
    225
  ];

function getFixedOrVariableOption(
  optionKeyName, progression = 1
) {
  const optionConfig = options.sketch?.[ optionKeyName ];

  if ( !optionConfig ) {
    return;
  }

  const {
    mode
  } = optionConfig;

  if ( "fixed" === mode ) {
    return optionConfig.value;
  }

  if ( "variable" === mode ) {
    const {
      startValue, endValue, count, speedMultiplier, progressionMultiplier, easingFn
    } = optionConfig;

    return mappers.fn(
      Math.sin( animation.angle * speedMultiplier +
      progression * progressionMultiplier ),
      -1,
      1,
      startValue,
      endValue,
      easing?.[ easingFn ] ?? easing.easeInOutSine
    );
  }
}

/**
 * Draws a seamless organic blob using Perlin Noise
 * * @param {number} baseRadius - The average size of the circle
 * @param baseRadius
 * @param {number} roughness  - How "spiky" or wavy the noise is (higher = more waves)
 * @param {number} magnitude  - How far the waves stick out from the circle
 * @param {number} zOffset    - The 'time' variable for the noise (change this to animate)
 * @param incrementStep
 */
function drawBlob(
  baseRadius, roughness, magnitude, zOffset, incrementStep = 0.05
) {
  beginShape();
  for ( let a = 0; a < TWO_PI; a += incrementStep ) {
    // const magnitude = getFixedOrVariableOption(
    //   "magnitude",
    //   a / ( TWO_PI - incrementStep )
    // );

    // THE TRICK: Map the circular angle to 2D Noise Space
    // This ensures that when angle is 0 and TWO_PI, we sample the exact same noise value.
    const xoff = map(
      cos( a ),
      -1,
      1,
      0,
      roughness
    );
    const yoff = map(
      sin( a ),
      -1,
      1,
      0,
      roughness
    );

    // Calculate radius based on noise
    const r =
      baseRadius + map(
        noise(
          xoff,
          yoff,
          zOffset
        ),
        0,
        1,
        -magnitude,
        magnitude
      );

    // Convert polar to cartesian coordinates
    const x = r * cos( a );
    const y = r * sin( a );

    vertex(
      x,
      y
    );
  }
  endShape( CLOSE ); // CLOSE ensures the last point connects to the first
}

sketch.draw( () => {
  background( ...getBackgroundColor() );

  push();
  translate(
    width / 2,
    height / 2
  );

  noFill();
  stroke( ...( options.sketch.shape.stroke ?? [
    0
  ] ) );
  strokeWeight( options.sketch.shape.strokeWeight ?? 0.5 );

  const linesCount = options.sketch.shape.linesCount ?? 50;
  const radiusOffsetMultiplier = options.sketch.shape.radiusOffsetMultiplier ?? 20;
  const noisePhaseMultiplier = options.sketch.shape.noisePhaseMultiplier ?? 0.02;
  const baseRadius = options.sketch.shape.baseRadius ?? 150;
  const roughness = options.sketch.shape.roughness ?? 1.5;
  const magnitude = options.sketch.shape.magnitude ?? 50;
  const zOffSpeed = options.sketch.shape.zOffSpeed ?? 0.005;
  const incrementStep = options.sketch.shape.incrementStep ?? 0.05;

  for ( let i = 0; i < linesCount; i++ ) {
    const radiusOffset = i * radiusOffsetMultiplier;
    const noisePhase = i * noisePhaseMultiplier;
    const lineProgression = i / ( linesCount - 1 );

    const roughness = getFixedOrVariableOption(
      "roughness",
      lineProgression
    );

    const magnitude = getFixedOrVariableOption(
      "magnitude",
      lineProgression
    );

    // We pass a unique z-offset for each line so they don't look identical
    drawBlob(
      baseRadius + radiusOffset,
      roughness,
      magnitude,
      sketchState.zOff + noisePhase,
      incrementStep
    );
  }

  pop();

  sketchState.zOff += zOffSpeed;

  renderTitle( options.sketch?.title );
} );
