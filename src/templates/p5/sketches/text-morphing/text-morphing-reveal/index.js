import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import string from "@/p5/utils/string.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

// ── text-morphing-reveal ───────────────────────────────────────────────────
// The reveal format: a list of words morphs through itself — question into
// answer, brand into tagline, before into after. Each step HOLDS the word
// readable for `morphing.hold` of its slot, then eases its outline points into
// the next word, scattering them mid-flight so the transition reads as a
// dissolve-and-reform rather than a slide.
//
// The word list cycles with `animation.progression` (circular indexing), so a
// full loop lands exactly back on the first word: every export is a seamless
// loop, which is the whole trick for the format's completion rate. Scatter
// amplitude is sin(π·morph), guaranteed zero at both ends of every step — the
// held word is always crisp.

sketch.draw( () => {
  const p = getP5();

  const text = options.sketch?.text ?? {};
  const morphing = options.sketch?.morphing ?? {};
  const points = options.sketch?.points ?? {};
  const background = options.sketch?.backgroundColor ?? [
    0,
    0,
    0
  ];

  p.clear();
  p.background( ...background );

  const words = String( text.words ?? "HOW?\nLIKE\nTHIS" )
    .split( "\n" )
    .map( ( word ) => word.trim() )
    .filter( ( word ) => word !== "" );

  if ( words.length === 0 ) {
    renderTitle();

    return;
  }

  const font = string.fonts?.[ text.font ] ?? string.fonts.martian;

  if ( !font?.font ) {
    // First frames while the font streams in — nothing to sample yet.
    return;
  }

  const size = ( text.size ?? 0.22 ) * p.width;
  const sampleFactor = text.sampleFactor ?? 0.15;
  const center = p.createVector(
    p.width / 2,
    p.height * ( text.verticalPosition ?? 0.5 )
  );

  // Playhead over the word list: which step we're in and how far through it.
  const steps = Math.max(
    words.length,
    1
  );
  const playhead = animation.progression * steps;
  const stepIndex = Math.floor( playhead ) % steps;
  const stepProgress = playhead - Math.floor( playhead );

  // Hold, then morph: the eased 0..1 morph amount for this step.
  const hold = Math.min(
    morphing.hold ?? 0.45,
    0.95
  );
  const easingFn = easing?.[ morphing.easing ] ?? easing.easeInOutExpo;
  const morph = stepProgress <= hold
    ? 0
    : easingFn( ( stepProgress - hold ) / ( 1 - hold ) );

  const fromPoints = string.getTextPoints( {
    text: words[ stepIndex ],
    position: center,
    size,
    font,
    sampleFactor,
    simplifyThreshold: 0
  } );

  const toPoints = string.getTextPoints( {
    text: words[ ( stepIndex + 1 ) % steps ],
    position: center,
    size,
    font,
    sampleFactor,
    simplifyThreshold: 0
  } );

  const morphedPoints = mappers.lerpPoints(
    fromPoints,
    toPoints,
    morph
  );

  drawPoints(
    morphedPoints,
    morph,
    morphing,
    points
  );

  renderTitle();
} );

/**
 * Render the morphed outline points. Mid-morph every point drifts along its
 * own noise direction, scaled by sin(π·morph) so the scatter blooms at the
 * midpoint and fully re-converges before the next hold.
 */
function drawPoints(
  morphedPoints, morph, morphing, points
) {
  const p = getP5();

  const scatterAmplitude = ( morphing.scatter ?? 0.35 ) *
    p.width *
    Math.sin( morph * Math.PI );
  const weight = points.strokeWeight ?? 10;
  const glow = points.glow ?? 24;
  const mono = points.color ?? [
    255,
    255,
    255
  ];
  const rainbow = ( points.colorMode ?? "rainbow" ) === "rainbow";

  p.push();
  p.strokeWeight( weight );

  if ( glow > 0 ) {
    p.drawingContext.shadowBlur = glow;
  }

  if ( !rainbow ) {
    p.stroke( ...mono );
    p.drawingContext.shadowColor = `rgb(${ mono[ 0 ] }, ${ mono[ 1 ] }, ${ mono[ 2 ] })`;
  }

  for ( let i = 0; i < morphedPoints.length; i++ ) {
    const progression = i / morphedPoints.length;
    const point = morphedPoints[ i ];

    // Stable per-point scatter direction: pure function of the point index, so
    // a point flies out and back along the same ray within a step.
    const scatterAngle = p.noise(
      i * 0.37,
      morph * ( morphing.scatterCurl ?? 0.5 )
    ) * p.TAU * 2;

    const x = point.x + Math.cos( scatterAngle ) * scatterAmplitude;
    const y = point.y + Math.sin( scatterAngle ) * scatterAmplitude;

    if ( rainbow ) {
      const color = colors.rainbow( {
        hueOffset: animation.angle,
        hueIndex: mappers.fn(
          p.noise(
            x / p.width,
            y / p.height
          ),
          0,
          1,
          -p.PI,
          p.PI
        ) * 4,
        opacityFactor: 1 + morph * 0.6
      } );

      p.stroke( color );
      p.drawingContext.shadowColor = color.toString();
    }

    p.point(
      x,
      y
    );
  }

  p.drawingContext.shadowBlur = 0;
  p.pop();
}
