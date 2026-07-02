import options from "@/p5/utils/options.js";
import animation from "@/p5/utils/animation.js";
import colors from "@/p5/utils/colors.js";
import sketch from "@/p5/utils/sketch.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  getFixedOrVariableOption, getVariableOptionValue
} from "@/p5/utils/common.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

sketch.setup( ( {
  canvas
} ) => {
  const p = getP5();

  p.background( ...getBackgroundColor() );
} );

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    246,
    235,
    225
  ];

// getFixedOrVariableOption's "variable" mode shades with
// sin( animation.angle * speedMultiplier + progression * progressionMultiplier )
// (see @/p5/utils/common.js, off-limits here) — already circular, so it only
// returns to its start value when speedMultiplier completes a WHOLE number of
// turns per loop. getFixedOrVariableOption accepts an already-resolved config
// object as well as an option name, so the snap is applied here, at the call
// site, without touching the shared helper.
function getLoopSnappedOption(
  name, progression
) {
  const config = options.sketch?.[ name ];

  if ( !config || config.mode !== "variable" ) {
    return getFixedOrVariableOption(
      name,
      progression
    );
  }

  return getFixedOrVariableOption(
    {
      ...config,
      speedMultiplier: Math.round( config.speedMultiplier ?? 1 )
    },
    progression
  );
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
  baseRadius, roughness, magnitude, zOffset, incrementStep = 0.05, lineProgression
) {
  const p = getP5();

  p.beginShape();
  for ( let a = 0; a < p.TWO_PI; a += incrementStep ) {
    const angleProgression = a / ( p.TWO_PI - incrementStep );
    // THE TRICK: Map the circular angle to 2D Noise Space
    // This ensures that when angle is 0 and p.TWO_PI, we sample the exact same noise value.
    const xoff = p.map(
      p.cos( a ),
      -1,
      1,
      0,
      roughness
    );
    const yoff = p.map(
      p.sin( a ),
      -1,
      1,
      0,
      roughness
    );

    // Calculate radius based on noise
    const r =
      baseRadius + p.map(
        p.noise(
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
    const x = r * p.cos( a );
    const y = r * p.sin( a );

    // getVariableOptionValue's phase is x * getLoopMultiplier( xMultiplier )
    // (see @/p5/utils/common.js, off-limits here), and getLoopMultiplier
    // already snaps the multiplier to a whole multiple of TAU (K * TAU) — so
    // sin( phase ) only closes the loop when x itself sweeps exactly one
    // WHOLE unit per loop. animation.angle sweeps TAU per loop, so x * K*TAU
    // would sweep K*TAU² — not a whole multiple of TAU, since TAU is
    // irrational. animation.progression sweeps exactly 0→1 per loop, so
    // x * K*TAU sweeps exactly K whole turns — loop-exact.
    p.stroke( colors.rainbow( {
      opacityFactor: getVariableOptionValue(
        options.sketch.colors.opacityFactor,
        {
          x: animation.progression,
          y: lineProgression,
          z: angleProgression
        }
      ),
      hueIndex: getVariableOptionValue(
        options.sketch.colors.hueIndex,
        {
          x: animation.progression,
          y: lineProgression,
          z: angleProgression
        }
      )
    } ) );

    p.point(
      x,
      y
    );
  }
  p.endShape( p.CLOSE ); // p.CLOSE ensures the last point connects to the first
}

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...getBackgroundColor() );

  p.push();
  p.translate(
    p.width / 2,
    p.height / 2
  );

  p.noFill();
  p.stroke( ...( options.sketch.shape.stroke ?? [
    0
  ] ) );
  p.strokeWeight( options.sketch.shape.strokeWeight ?? 0.5 );

  const linesCount = options.sketch.shape.linesCount ?? 50;
  const incrementStep = options.sketch.shape.incrementStep ?? 0.05;

  const timeRadius = 1.5; // Controls how much the noise changes over the loop
  const zLoop = p.map(
    p.cos( animation.angle ),
    -1,
    1,
    0,
    timeRadius
  );

  for ( let i = 0; i < linesCount; i++ ) {
    const lineProgression = i / ( linesCount - 1 );

    const noisePhaseMultiplier = getLoopSnappedOption(
      "noisePhaseMultiplier",
      lineProgression
    );

    const noisePhase = i * noisePhaseMultiplier;

    const radiusOffsetMultiplier = getLoopSnappedOption(
      "radiusOffsetMultiplier",
      lineProgression
    );

    const roughness = getLoopSnappedOption(
      "roughness",
      lineProgression
    );

    const magnitude = getLoopSnappedOption(
      "magnitude",
      lineProgression
    );

    const baseRadius = getLoopSnappedOption(
      "baseRadius",
      lineProgression
    );

    const radiusOffset = i * radiusOffsetMultiplier;

    // We pass a unique z-offset for each line so they don't look identical
    drawBlob(
      baseRadius + radiusOffset,
      roughness,
      magnitude,
      zLoop + noisePhase,
      incrementStep,
      lineProgression
    );
  }

  p.pop();

  renderTitle( options.sketch?.title );
} );
